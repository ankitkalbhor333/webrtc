# Screen Sharing: Real-World Scenarios & Edge Cases

## Scenario 1: User Grants Permission Then Denies

### What Happens
```
1. User clicks "Share Screen"
2. Permission dialog appears
3. User clicks "Allow"
4. Screen picker shows
5. User changes mind, closes screen picker WITHOUT selecting
```

### Expected Behavior
- Error message shown: "No screen or window found to share"
- Screen share state remains off
- Camera continues normally

### Code Handling
```javascript
try {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({...});
  // If user closes picker without selecting, NotFoundError thrown
  const screenTrack = screenStream.getVideoTracks()[0];
  if (!screenTrack) {
    throw new Error('No video track in display stream');
  }
} catch (err) {
  if (err.name === 'NotFoundError') {
    // User closed picker without selecting
  }
}
```

---

## Scenario 2: Second Monitor Disconnected During Share

### What Happens
```
1. User has 2 monitors
2. Shares secondary monitor
3. User physically unplugs second monitor
4. Display stream becomes invalid
```

### Expected Behavior
- Screen track's `readyState` changes to "ended"
- `onended` event fires
- Camera automatically restores
- User sees message "Screen disconnected"

### Code Handling
```javascript
screenTrack.onended = async () => {
  console.log('Screen ended - might be unplugged');
  await stopScreenShare();  // Auto-restore camera
  showNotification('Screen was disconnected');
};
```

---

## Scenario 3: Window Being Shared is Closed

### What Happens
```
1. User shares browser window (or app window)
2. User closes that window
3. Track becomes invalid
```

### Expected Behavior
- Screen goes black or gray
- `onended` fires
- Camera restored
- No error, just smooth restoration

### Testing
```javascript
// To test:
// 1. Share Chrome window
// 2. Close Chrome
// 3. Verify camera restores
```

---

## Scenario 4: User on Metered Connection (Mobile Hotspot)

### What Happens
```
- Bandwidth: ~2 Mbps
- Screen at full 1080p needs ~3-4 Mbps
- Packet loss and freezing occur
```

### Solution
```javascript
// Detect poor connection
const bandwidth = await measureBandwidth();

if (bandwidth < 2500) {
  // Use adaptive constraints
  const constraints = getAdaptiveConstraints(bandwidth);
  const screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
  
  // Inform user
  showWarning('Connection is slow - screen may be choppy');
}
```

---

## Scenario 5: Browser Tab in Background

### What Happens
```
1. User shares screen
2. Browser tab goes to background
3. JS execution throttled
4. No frame updates sent
```

### Solution
```javascript
// Listen for visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Tab hidden - pause screen share or inform user
    console.warn('Tab hidden - screen share may pause');
  } else {
    // Tab visible - resume
    console.log('Tab visible - screen share resumed');
  }
});
```

---

## Scenario 6: Call on Multiple Tabs Simultaneously

### What Happens
```
1. User has WebRTC call on Tab A
2. Opens same app in Tab B
3. Joins same room from Tab B
4. Both tabs try to use same screen stream
```

### Risk
- Screen stream gets shared between tabs
- One tab stops screen share, other might break
- Resource conflicts

### Recommendation
```javascript
// In your component
useEffect(() => {
  // Detect if connection already exists
  if (peerConnectionRef.current) {
    console.warn('Another tab might have same call');
    setWarning('Multiple tabs with same call detected');
  }
  
  return () => {
    // Clean up when tab closes
    cleanup();
  };
}, []);
```

---

## Scenario 7: Network Drops During Screen Share

### What Happens
```
1. Screen sharing active
2. Network drops (WiFi disconnects)
3. Peer connection closes
```

### Expected Behavior
```
1. RTCPeerConnection state → 'failed'
2. Screen share continues locally (but not transmitted)
3. User should stop screen share
4. Then try to reconnect
```

### Code Handling
```javascript
pc.onconnectionstatechange = () => {
  if (pc.connectionState === 'failed') {
    // Network failed
    setError('Connection lost - screen share paused');
    
    // Optionally stop screen share
    if (isScreenSharing) {
      stopScreenShare();
    }
  }
};
```

---

## Scenario 8: Microphone Audio While Screen Sharing

### What Happens
```
1. User starts screen share
2. getDisplayMedia() might include system audio
3. Microphone track still active
4. Two audio sources sent
```

### Risk
- Echo or audio issues
- Bandwidth wasted on duplicate audio

### Solution
```javascript
// In hook - already does this
const screenStream = await navigator.mediaDevices.getDisplayMedia({
  video: {...},
  audio: false  // ← Explicitly disable
});

// Keep only microphone audio from original stream
const audioTracks = cameraStream.getAudioTracks();
// Already in connection from initial addTrack()
```

---

## Scenario 9: User Rapidly Toggles Screen Share

### What Happens
```
1. User clicks "Share Screen"
2. Immediately clicks "Stop Sharing"
3. Then "Share Screen" again
4. Multiple promises in flight
```

### Risk
```
- Race conditions
- Memory leaks if not cleaned up
- State inconsistency
```

### Solution
```javascript
// In hook - use ref to track state
const isProcessingRef = useRef(false);

const startScreenShare = useCallback(async () => {
  if (isProcessingRef.current) {
    console.warn('Screen share already processing');
    return;
  }
  
  isProcessingRef.current = true;
  
  try {
    // ... screen share logic
  } finally {
    isProcessingRef.current = false;
  }
}, []);
```

---

## Scenario 10: Safari on macOS Permission Issues

### What Happens
```
1. User runs on Safari
2. First screen share attempt
3. macOS shows "Allow" dialog
4. User must click "Allow" (not automatic)
```

### Expected Behavior
- First share always shows macOS permission
- Subsequent shares don't need permission
- Permission stored in system settings

### Code Handling
```javascript
// Safari requires user gesture
const handleScreenShareClick = async () => {
  // Must be called from click handler (user gesture)
  try {
    await toggleScreenShare();
  } catch (error) {
    if (navigator.userAgent.includes('Safari')) {
      setError('Safari: Please click Allow in system dialog');
    }
  }
};
```

---

## Scenario 11: Screen Resolution Changes During Share

### What Happens
```
1. User shares 1080p monitor
2. Disconnects external monitor
3. Resolution changes to 1366x768
4. Screen stream still broadcasting old resolution
```

### Impact
- Video aspect ratio might be wrong
- Bandwidth mismatch

### Not Easily Handled
```javascript
// Not much you can do about this
// Option: Force screen re-share with new resolution
// Not recommended - disruptive

// Alternative: Listen for display change
window.addEventListener('screen-change', () => {
  // Could trigger re-share if needed
});
```

---

## Scenario 12: Very Low Bandwidth (100 kbps)

### What Happens
```
- Screen minimum ~500 kbps
- User has 100 kbps available
- Extreme packet loss
```

### Recommendation
```javascript
// Warn user before attempting
const bandwidth = await measureBandwidth();

if (bandwidth < 500) {
  if (!confirm('Connection very slow - screen share will be choppy. Continue?')) {
    return;
  }
}

// Use minimum constraints
const constraints = getAdaptiveConstraints(100);
```

---

## Scenario 13: GPU Memory Pressure

### What Happens
```
1. Heavy screen content (video, animations)
2. Host machine low on GPU memory
3. Encoding struggles
4. Freezing or stuttering
```

### Symptoms
- CPU 100% but frames dropping
- "Jittery" feeling to shared screen
- Sporadic freeze-then-resume

### Solution
```javascript
// Monitor dropped frames
const stats = await pc.getStats();
stats.forEach(report => {
  if (report.type === 'outbound-rtp' && report.kind === 'video') {
    const dropRatio = report.framesDropped / report.framesSent;
    if (dropRatio > 0.1) {  // >10% dropped
      console.warn('High frame drop - CPU overloaded');
      // Could reduce resolution/framerate
    }
  }
});
```

---

## Scenario 14: Custom Cursor Display

### What Happens
```
getDisplayMedia({
  video: {
    cursor: 'always'  // or 'motion' or 'never'
  }
})
```

### Options
```
'always'  - Cursor always visible
'motion' - Cursor only when moving
'never'  - Cursor never visible (default in some browsers)
```

### Recommendation
```javascript
// Show cursor - helps viewers follow actions
const constraints = {
  video: {
    cursor: 'always'  // ← Users can see what host clicking
  }
};
```

---

## Scenario 15: Permission Remembered But Screen Denied

### What Happens
```
1. User grants screen share permission
2. Browser remembers permission
3. Browser privacy settings changed
4. Next attempt: Permission re-requested
```

### Expected
- Browser shows permission dialog again
- User clicks Allow again
- Works fine

### Rare Issue
- Browser crashes or bug
- Permission forgotten
- Solution: Clear browser cache/permissions

---

## Performance Metrics Interpretation

### What Each Stat Means

```javascript
const stats = await pc.getStats();
stats.forEach(report => {
  if (report.type === 'outbound-rtp' && report.kind === 'video') {
    
    // Total bytes sent
    console.log('bytesSent:', report.bytesSent);
    // Calculate bitrate: (bytesSent * 8) / seconds
    
    // Total packets sent
    console.log('packetsSent:', report.packetsSent);
    
    // Packets lost in network
    console.log('packetsLost:', report.packetsLost);
    // Loss ratio: packetsLost / (packetsLost + packetsSent)
    
    // Frames successfully encoded
    console.log('framesSent:', report.framesSent);
    
    // Frames dropped due to encoding/CPU
    console.log('framesDropped:', report.framesDropped);
    
    // Total frame dimensions
    console.log('frameWidth:', report.frameWidth);
    console.log('frameHeight:', report.frameHeight);
    
    // Encoding time per frame (avg)
    console.log('totalEncodeTime:', report.totalEncodeTime);
    
    // Quality limitations
    console.log('qualityLimitation:', report.qualityLimitation);
    // Values: 'none', 'cpu', 'bandwidth', 'other'
  }
});
```

### Interpreting Quality Limitation

```
'none'      - Everything optimal
'cpu'       - CPU overloaded, dropping frames
'bandwidth' - Network constrained, reducing bitrate
'other'     - Some other limitation
```

### Red Flags

```
- framesDropped > 0               → CPU pressure
- qualityLimitation === 'cpu'     → Reduce resolution/fps
- packetLoss > 2%                 → Network issues
- framesSent very low (~0-5)      → Connection unstable
- bytesSent not increasing        → No data flowing
```

---

## Debug Checklist

If screen sharing not working:

- [ ] Browser supports getDisplayMedia (check in console)
- [ ] Permission was granted
- [ ] Selected screen/window
- [ ] PC connection state is 'connected'
- [ ] videoSender exists and has active track
- [ ] replaceTrack promise resolved
- [ ] Screen track readyState is 'live'
- [ ] Local video ref updated
- [ ] No JavaScript errors in console
- [ ] Network connectivity good
- [ ] Not in private/incognito mode
- [ ] Screen not locked/in screensaver
- [ ] Display drivers up to date

---

## Browser-Specific Issues

### Chrome
- ✅ Works great
- ⚠️ In some older versions, audio not supported
- ⚠️ Chromebook: Might need flags enabled

### Firefox
- ✅ Works great
- ⚠️ First share always shows notification
- ⚠️ Tab audio sharing requires extra permission

### Safari (macOS)
- ✅ Works on Monterey+
- ⚠️ iOS: Not supported
- ⚠️ Requires macOS Monterey (12.0) minimum
- ⚠️ System may ask for permission

### Edge
- ✅ Same as Chrome (Chromium-based)

### Opera
- ✅ Same as Chrome (Chromium-based)

---

## Production Guidelines

1. **Always check browser support**
   ```javascript
   if (!navigator.mediaDevices?.getDisplayMedia) {
     disableScreenShareButton();
   }
   ```

2. **Always handle errors gracefully**
   ```javascript
   try {
     await toggleScreenShare();
   } catch (error) {
     showUserFriendlyError(error);
   }
   ```

3. **Always clean up resources**
   ```javascript
   useEffect(() => {
     return () => {
       cleanup();
     };
   }, []);
   ```

4. **Monitor performance**
   ```javascript
   monitorPeerConnectionStats(pc, (stats) => {
     logToAnalytics(stats);
   });
   ```

5. **Test on real devices and networks**
   - Not just localhost
   - Various bandwidth conditions
   - Different browsers

6. **Document limitations for users**
   - Screen sharing only, not audio
   - Requires browser permission
   - Bandwidth requirements
