# Screen Sharing: Common Bugs & Solutions

## Bug 1: Black Screen After Screen Share Stops

### Symptom
- User shares screen, then clicks "Stop Sharing"
- Local video becomes black/blank
- Remote peer sees black too

### Root Cause
```javascript
// WRONG - stops the track but doesn't restore camera
const stopScreenShare = () => {
  screenTrack.stop();  // ← Just stops it!
  // Missing: replaceTrack(cameraTrack)
};
```

### Solution
```javascript
// CORRECT - restore camera track
const stopScreenShare = async () => {
  if (!cameraTrack) {
    console.error('No camera track to restore');
    return;
  }
  
  try {
    await videoSender.replaceTrack(cameraTrack);
    screenTrack.stop();  // Stop screen track AFTER replace
    console.log('Restored camera track');
  } catch (error) {
    console.error('Failed to restore camera:', error);
    // Fallback: recreate connection if necessary
  }
};
```

---

## Bug 2: "onended" Event Never Fires

### Symptom
- User clicks browser's "Stop Sharing" button
- Component doesn't detect it
- Video continues as black

### Root Cause
```javascript
// WRONG - not listening to track.onended
const screenTrack = screenStream.getVideoTracks()[0];
// Missing: screenTrack.onended = () => {...}
```

### Solution
```javascript
// CORRECT - listen for native stop
const screenTrack = screenStream.getVideoTracks()[0];

screenTrack.onended = async () => {
  console.log('User stopped screen share from browser');
  
  // Restore camera immediately
  if (cameraTrack) {
    await videoSender.replaceTrack(cameraTrack);
  }
  
  // Update UI
  setIsScreenSharing(false);
};
```

---

## Bug 3: "Permission Denied" on Second Share Attempt

### Symptom
- First screen share works fine
- User stops and clicks "Share Again"
- getDisplayMedia() throws "NotAllowedError"

### Root Cause
```javascript
// WRONG - not properly cleaning up previous stream
const shareScreen = async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia({...});
  // If this fails on retry, stream from previous attempt still active
};
```

### Solution
```javascript
// CORRECT - clean up previous stream
let previousScreenStream = null;

const shareScreen = async () => {
  try {
    // Stop previous attempt if exists
    if (previousScreenStream) {
      previousScreenStream.getTracks().forEach(t => t.stop());
    }
    
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });
    
    previousScreenStream = stream;
    const screenTrack = stream.getVideoTracks()[0];
    
    // ... rest of code
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      console.log('User denied permission');
    } else if (error.name === 'NotFoundError') {
      console.log('No screen available');
    }
  }
};
```

---

## Bug 4: Both Camera and Screen Tracks Sent

### Symptom
- Screen share works but still sending camera video too
- High bitrate (4000+ kbps)
- Both video tracks reaching peer

### Root Cause
```javascript
// WRONG - using addTrack instead of replaceTrack
socket.on('offer', async (data) => {
  const screenTrack = screenStream.getVideoTracks()[0];
  pc.addTrack(screenTrack, screenStream);  // ← WRONG! Adds instead of replaces
  // Now peer receives both camera AND screen
});
```

### Solution
```javascript
// CORRECT - use replaceTrack
const shareScreen = async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia({...});
  const screenTrack = stream.getVideoTracks()[0];
  
  // Get existing sender
  const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
  
  if (videoSender) {
    await videoSender.replaceTrack(screenTrack);  // ← CORRECT!
  } else {
    // Fallback if no sender exists (shouldn't happen in established connection)
    pc.addTrack(screenTrack, stream);
  }
};
```

---

## Bug 5: Local Video Element Shows Wrong Source

### Symptom
- User starts screen share
- Local preview shows camera (should show screen)
- OR shows screen at wrong resolution
- Aspect ratio wrong

### Root Cause
```javascript
// WRONG - local video ref not updated
const shareScreen = async () => {
  const screenTrack = screenStream.getVideoTracks()[0];
  await videoSender.replaceTrack(screenTrack);
  
  // localVideoRef.srcObject still has old stream with camera
  // Need to update it with screen stream
};
```

### Solution
```javascript
// CORRECT - update local preview with screen stream
const shareScreen = async () => {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({...});
  const screenTrack = screenStream.getVideoTracks()[0];
  
  // Update local preview
  localVideoRef.current.srcObject = screenStream;
  
  // Update peer connection
  const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
  await videoSender.replaceTrack(screenTrack);
  
  // Listen for stop event
  screenTrack.onended = async () => {
    // Restore camera preview AND peer
    localVideoRef.current.srcObject = cameraStream;
    await videoSender.replaceTrack(cameraTrack);
  };
};
```

---

## Bug 6: "No RTCRtpSender Found"

### Symptom
- Error: "Cannot read property 'replaceTrack' of undefined"
- Screen share button does nothing

### Root Cause
```javascript
// WRONG - trying to find sender before connection established
const handleShareScreen = () => {
  const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
  // videoSender might be null/undefined if:
  // 1. Peer connection not ready
  // 2. No video track added initially
  // 3. getSenders() returns empty array
};
```

### Solution
```javascript
// CORRECT - verify sender exists and connection ready
const shareScreen = async () => {
  // Check connection state
  if (pc.connectionState !== 'connected') {
    console.error('Peer connection not ready');
    return;
  }
  
  const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
  
  if (!videoSender) {
    console.error('No video sender found - ensure camera track added initially');
    return;
  }
  
  const screenStream = await navigator.mediaDevices.getDisplayMedia({...});
  const screenTrack = screenStream.getVideoTracks()[0];
  
  try {
    await videoSender.replaceTrack(screenTrack);
  } catch (error) {
    console.error('replaceTrack failed:', error);
  }
};
```

---

## Bug 7: Receiver Doesn't See Screen (Black on Remote)

### Symptom
- Local shows screen correctly
- Remote peer sees black/nothing
- No error thrown

### Root Cause
```javascript
// WRONG - replaceTrack succeeded but receiver not notified
// This is rare, usually means codec mismatch or old browser
```

### Solution
```javascript
// CORRECT - verify track replacement and monitor stats
const shareScreen = async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia({...});
  const screenTrack = stream.getVideoTracks()[0];
  const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
  
  const result = await videoSender.replaceTrack(screenTrack);
  
  // Verify replacement
  console.log('New sender track:', videoSender.track.id);
  console.log('Screen track:', screenTrack.id);
  console.assert(videoSender.track.id === screenTrack.id, 'Track not replaced!');
  
  // Monitor stats to verify data flowing
  setTimeout(async () => {
    const stats = await pc.getStats();
    stats.forEach(report => {
      if (report.type === 'outbound-rtp' && report.kind === 'video') {
        console.log('Bytes sent:', report.bytesSent);
        if (report.bytesSent === 0) {
          console.warn('No data being sent - check network/codec');
        }
      }
    });
  }, 1000);
};
```

---

## Bug 8: Audio Continues But Video Freezes

### Symptom
- After sharing screen, video freezes
- Audio keeps working
- Both ends affected

### Root Cause
```javascript
// Usually caused by:
// 1. Screen resolution too high for network
// 2. CPU overloaded with screen encoding
// 3. Frame rate too high
// 4. Bitrate cap too low
```

### Solution
```javascript
// CORRECT - use display media constraints
const shareScreen = async () => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        displaySurface: 'monitor',
        logicalSurface: true,
        // Limit resolution if needed
        frameRate: 15,  // ← Reduce if freezing
        width: { max: 1280 },  // ← Cap resolution
        height: { max: 720 }
      },
      audio: false
    });
    
    const screenTrack = screenStream.getVideoTracks()[0];
    const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
    
    await videoSender.replaceTrack(screenTrack);
    
  } catch (error) {
    console.error('Screen share failed:', error);
  }
};
```

---

## Bug 9: Memory Leak - Tracks Not Cleaned Up

### Symptom
- After multiple screen shares, app becomes slow
- Memory usage keeps increasing
- Browser tab uses 100% CPU

### Root Cause
```javascript
// WRONG - not stopping tracks properly
const shareScreen = async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia({...});
  // If user presses screen share multiple times:
  // Old streams never stopped → memory leak
};
```

### Solution
```javascript
// CORRECT - track cleanup in ref
let cameraStream = null;
let screenStream = null;

const shareScreen = async () => {
  try {
    // Stop previous screen stream if exists
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }
    
    screenStream = await navigator.mediaDevices.getDisplayMedia({...});
    const screenTrack = screenStream.getVideoTracks()[0];
    
    const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
    await videoSender.replaceTrack(screenTrack);
    
    // Handle stop with cleanup
    screenTrack.onended = async () => {
      screenStream?.getTracks().forEach(t => t.stop());
      screenStream = null;
      
      if (cameraStream) {
        const cameraTrack = cameraStream.getVideoTracks()[0];
        await videoSender.replaceTrack(cameraTrack);
      }
    };
    
  } catch (error) {
    console.error('Screen share error:', error);
    screenStream?.getTracks().forEach(t => t.stop());
    screenStream = null;
  }
};

// On component unmount
useEffect(() => {
  return () => {
    cameraStream?.getTracks().forEach(t => t.stop());
    screenStream?.getTracks().forEach(t => t.stop());
  };
}, []);
```

---

## Bug 10: replaceTrack() Rejects Promise

### Symptom
- `await videoSender.replaceTrack(track)` throws error
- Error message: "replaceTrack failed"
- No clear reason why

### Root Cause
```
Common reasons:
1. Track is already stopped (invalid state)
2. Track kind doesn't match (audio sender, video track)
3. Track is from another device/origin (security)
4. RTCRtpSender is closed
5. Browser bug or incompatibility
```

### Solution
```javascript
// CORRECT - robust error handling
const shareScreen = async () => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({...});
    const screenTrack = screenStream.getVideoTracks()[0];
    
    if (!screenTrack) {
      throw new Error('No video track in screen stream');
    }
    
    const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
    
    if (!videoSender) {
      throw new Error('No active video sender');
    }
    
    // Verify track is in valid state
    if (screenTrack.readyState !== 'live') {
      throw new Error('Screen track not in live state');
    }
    
    try {
      await videoSender.replaceTrack(screenTrack);
      console.log('Screen share activated');
    } catch (replaceError) {
      console.error('replaceTrack failed:', replaceError);
      
      // Fallback: stop screen and show error
      screenTrack.stop();
      screenStream.getTracks().forEach(t => t.stop());
      
      // Notify user
      alert('Screen share failed. Try again or reload page.');
      
      // Optional: Force renegotiation if replaceTrack fails
      // (Not recommended but works as last resort)
      throw replaceError;
    }
    
  } catch (error) {
    console.error('Screen sharing error:', error);
    setError(error.message);
  }
};
```

---

## Summary Checklist

- [ ] Always use `replaceTrack()` not `addTrack()`
- [ ] Listen to `track.onended` for browser stop button
- [ ] Store reference to camera track before screen share
- [ ] Stop tracks when done to prevent memory leak
- [ ] Update local video element to show screen
- [ ] Check peer connection state before attempting share
- [ ] Verify videoSender exists and has active track
- [ ] Clean up on component unmount
- [ ] Handle permission denied gracefully
- [ ] Test on actual network, not just localhost
