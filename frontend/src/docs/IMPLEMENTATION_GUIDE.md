# Screen Sharing Implementation Guide

## Quick Start: 3 Steps to Add Screen Sharing

### Step 1: Add useScreenShare Hook
```jsx
import { useScreenShare } from '../hooks/useScreenShare.js';

// Inside your component
const {
  isScreenSharing,
  error,
  toggleScreenShare
} = useScreenShare(peerConnection, cameraStream, localVideoRef);
```

### Step 2: Add Screen Share Button
```jsx
<button onClick={toggleScreenShare} disabled={!isScreenSharingSupported()}>
  {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
</button>
```

### Step 3: Handle Errors
```jsx
{error && <div className="error">{error}</div>}
```

---

## Complete Implementation Example

### File Structure
```
frontend/src/
├── hooks/
│   ├── useAuth.js (existing)
│   └── useScreenShare.js (NEW)
├── utils/
│   ├── api.js (existing)
│   └── screenShareUtils.js (NEW)
├── docs/
│   ├── SCREEN_SHARING_GUIDE.md (NEW)
│   └── SCREEN_SHARING_BUGS.md (NEW)
└── pages/
    ├── WebRTCCall.jsx (existing)
    └── WebRTCCall_WithScreenShare.jsx (reference implementation)
```

### Installation Steps

**1. Copy Hook to your project**
```bash
cp frontend/src/hooks/useScreenShare.js your-project/frontend/src/hooks/
```

**2. Copy Utilities to your project**
```bash
cp frontend/src/utils/screenShareUtils.js your-project/frontend/src/utils/
```

**3. Update your WebRTCCall.jsx component** (see detailed steps below)

---

## Detailed Integration into Your WebRTCCall.jsx

### Step 1: Import Dependencies
Add to the top of `WebRTCCall.jsx`:

```javascript
import { useScreenShare } from '../hooks/useScreenShare.js';
import {
  isScreenSharingSupported,
  getErrorMessage,
  stopMediaStream
} from '../utils/screenShareUtils.js';
```

### Step 2: Initialize Hook
In your component, after `useRef` declarations:

```javascript
// Add with your other hooks
const {
  isScreenSharing,
  error: screenShareError,
  toggleScreenShare,
  cleanup: cleanupScreenShare
} = useScreenShare(
  peerConnectionRef.current,
  localStreamRef.current,
  localVideoRef
);
```

### Step 3: Update Cleanup Function
Modify your existing `cleanup` function:

```javascript
const cleanup = () => {
  pendingIceCandidatesRef.current = [];

  if (peerConnectionRef.current) {
    peerConnectionRef.current.close();
    peerConnectionRef.current = null;
  }
  if (socketRef.current) {
    socketRef.current.removeAllListeners();
    socketRef.current.disconnect();
    socketRef.current = null;
  }
  if (localStreamRef.current) {
    stopMediaStream(localStreamRef.current);  // Use utility function
    localStreamRef.current = null;
  }
  remoteStreamRef.current = null;
  remoteSocketIdRef.current = null;

  // NEW: Clean up screen share resources
  cleanupScreenShare();
};
```

### Step 4: Add Screen Share Toggle Handler
Add this new function:

```javascript
const handleScreenShareClick = async () => {
  if (!isScreenSharingSupported()) {
    setErrorMsg('Screen sharing not supported in your browser');
    return;
  }

  try {
    await toggleScreenShare();
  } catch (error) {
    console.error('Screen share toggle error:', error);
  }
};
```

### Step 5: Add Screen Share Button to UI
In your JSX, add button after microphone/camera buttons:

```jsx
{/* Screen sharing button */}
{isScreenSharingSupported() && (
  <button
    className={`control-btn ${isScreenSharing ? 'on' : 'off'}`}
    onClick={handleScreenShareClick}
    title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
    type="button"
  >
    🖥️
  </button>
)}
```

### Step 6: Display Screen Share Status
Add to your status section:

```jsx
<div className="status-info">
  <p>Connection: {connectionState || 'connecting...'}</p>
  {isScreenSharing && <p className="screen-share-active">🖥️ Sharing screen</p>}
</div>
```

### Step 7: Display Screen Share Error
Add error display:

```jsx
{screenShareError && (
  <div className="error-message">
    <p>Screen Share: {screenShareError}</p>
  </div>
)}
```

---

## CSS Styling (Add to your CSS file)

```css
/* Screen share button styling */
.control-btn {
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  background-color: #f0f0f0;
  cursor: pointer;
  font-size: 20px;
  transition: all 0.3s ease;
}

.control-btn.on {
  background-color: #4CAF50;
  color: white;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.control-btn.off {
  background-color: #f0f0f0;
  color: #333;
}

.control-btn:hover {
  transform: scale(1.05);
}

.control-btn.leave-btn {
  background-color: #f44336;
  color: white;
  margin-left: auto;
}

.screen-share-active {
  color: #4CAF50;
  font-weight: bold;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.error-message {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #f44336;
  color: white;
  padding: 15px 20px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  z-index: 1000;
}

.error-message button {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 20px;
  padding: 0;
}
```

---

## How the Screen Share Hook Works Internally

### Initialization Phase
```
1. Component mounts
2. useScreenShare hook receives:
   - peerConnection (RTCPeerConnection)
   - cameraStream (MediaStream with camera)
   - localVideoRef (reference to video element)
3. Hook stores camera track reference for later restoration
```

### Starting Screen Share
```
Step 1: User clicks "Share Screen" button
   └─> toggleScreenShare() called

Step 2: Browser shows screen/window picker
   └─> User selects what to share

Step 3: Get display stream
   └─> navigator.mediaDevices.getDisplayMedia()
   └─> Returns MediaStream with screen content

Step 4: Extract video track
   └─> screenStream.getVideoTracks()[0]
   └─> Get first (only) video track from screen

Step 5: Get existing video sender
   └─> pc.getSenders().find(s => s.track?.kind === 'video')
   └─> This RTCRtpSender was created when camera added initially

Step 6: Replace track (CRITICAL - No renegotiation!)
   └─> await videoSender.replaceTrack(screenTrack)
   └─> Swap video track atomically
   └─> Peer automatically sees screen (same SDP!)

Step 7: Update local preview
   └─> localVideoRef.current.srcObject = screenStream
   └─> Show screen in local preview

Step 8: Listen for stop event
   └─> screenTrack.onended = () => stopScreenShare()
   └─> If user clicks browser "Stop Sharing", auto-restore camera
```

### Stopping Screen Share
```
Step 1: User clicks "Stop Sharing" or browser stop button
   └─> stopScreenShare() triggered

Step 2: Get video sender again
   └─> pc.getSenders().find(s => s.track?.kind === 'video')

Step 3: Get original camera track
   └─> cameraTrackRef.current
   └─> This was saved at initialization

Step 4: Replace back to camera
   └─> await videoSender.replaceTrack(cameraTrack)
   └─> Switch from screen to camera (same atomic process)

Step 5: Update local preview
   └─> localVideoRef.current.srcObject = cameraStream
   └─> Show camera in local preview

Step 6: Clean up screen stream
   └─> screenStream.getTracks().forEach(t => t.stop())
   └─> Free resources used by screen capture

Step 7: Update state
   └─> setIsScreenSharing(false)
   └─> Update UI to show normal state
```

---

## Key Concepts Explained

### Why replaceTrack() Instead of addTrack()?

**addTrack() creates problems:**
```javascript
// WRONG - Creates NEW sender
pc.addTrack(screenTrack, screenStream);
// Problems:
// 1. New offer/answer needed (latency)
// 2. Both tracks now active (bandwidth wasted)
// 3. Peer sees both camera AND screen
// 4. Cleanup complexity
```

**replaceTrack() is elegant:**
```javascript
// CORRECT - Uses existing sender
const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
await videoSender.replaceTrack(screenTrack);
// Advantages:
// 1. No renegotiation (instant)
// 2. Only one track active (efficient)
// 3. Peer sees only screen
// 4. Simple cleanup
```

### Why No Renegotiation?

The original offer/answer SDP negotiation established:
- Video sender exists
- Codec agreed on (H.264, VP8, etc.)
- Parameters set (bitrate, resolution)

When replacing track:
- Same sender still active
- Same codec still valid
- Just swap the source

No need to renegotiate! It's like swapping the camera input without changing the connection.

---

## Testing Screen Sharing

### Test Cases

**1. Basic Screen Share**
- [ ] Click "Share Screen"
- [ ] Select monitor/window
- [ ] Screen visible in local preview
- [ ] Remote peer sees screen

**2. Stop via Button**
- [ ] Click "Stop Sharing"
- [ ] Camera restores in local preview
- [ ] Remote peer sees camera again
- [ ] No errors in console

**3. Stop via Browser**
- [ ] Click "Share Screen"
- [ ] Click browser's "Stop Sharing"
- [ ] Camera auto-restores
- [ ] No black screen

**4. Permission Denied**
- [ ] Click "Share Screen"
- [ ] Click "Cancel" in permission dialog
- [ ] Error shown to user
- [ ] No crash

**5. Multiple Shares**
- [ ] Share screen
- [ ] Stop
- [ ] Share again
- [ ] Works second time

**6. Network Conditions**
- [ ] On slow connection
- [ ] Test with poor bandwidth
- [ ] Reduce frame rate if needed

---

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 72+ | ✅ Full | Works great |
| Firefox 66+ | ✅ Full | Works great |
| Safari 13+ | ✅ Full | Requires user gesture |
| Edge 79+ | ✅ Full | Same as Chrome |
| Opera 59+ | ✅ Full | Same as Chrome |
| IE 11 | ❌ No | Not supported |

### Platform Support

| Platform | Support | Notes |
|----------|---------|-------|
| Windows | ✅ Yes | All browsers |
| macOS | ✅ Yes | All browsers |
| Linux | ✅ Yes | Chrome, Firefox |
| Android | ⚠️ Limited | Android 11+ Chrome only |
| iOS | ❌ No | Not supported by Apple |

---

## Performance Tuning

### Constraint Presets

Use utility function `getDisplayMediaConstraints()`:

```javascript
// HD (720p) - good balance
const constraints = getDisplayMediaConstraints('hd');

// Full HD (1080p) - best quality, needs good bandwidth
const constraints = getDisplayMediaConstraints('full-hd');

// Mobile (480p) - low bandwidth
const constraints = getDisplayMediaConstraints('mobile');
```

### Adaptive Quality

Use `getAdaptiveConstraints()` based on measured bandwidth:

```javascript
// Measure available bandwidth
const bandwidth = measureBandwidth(); // your function

// Get appropriate constraints
const constraints = getAdaptiveConstraints(bandwidth);

const screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
```

### Monitor Performance

```javascript
import { monitorPeerConnectionStats } from '../utils/screenShareUtils.js';

// Start monitoring every second
const statsIntervalId = monitorPeerConnectionStats(pc, (stats) => {
  console.log('Bitrate:', Math.round(stats.video.bytesSent / 1000), 'kbps');
  console.log('Frames dropped:', stats.video.framesDropped);
});

// Stop monitoring
clearInterval(statsIntervalId);
```

---

## Troubleshooting Common Issues

### Black screen after screen share stops
**Solution:** See SCREEN_SHARING_BUGS.md - Bug #1

### Screen share doesn't work second time
**Solution:** See SCREEN_SHARING_BUGS.md - Bug #3

### Both camera and screen visible to remote
**Solution:** See SCREEN_SHARING_BUGS.md - Bug #4

### High CPU/bandwidth usage
**Solution:** Use `getAdaptiveConstraints()` with lower frame rate

### Safari permission issues
**Solution:** Requires user click/touch to start screen share

---

## Production Checklist

- [ ] Imported useScreenShare hook
- [ ] Imported screen share utilities
- [ ] Added screen share button to UI
- [ ] Added error handling/display
- [ ] Added cleanup on component unmount
- [ ] Tested on Chrome, Firefox, Safari
- [ ] Tested permission denied scenario
- [ ] Tested stop via button
- [ ] Tested stop via browser button
- [ ] Tested multiple consecutive shares
- [ ] Tested on slow network
- [ ] CSS styled for screen sharing UI
- [ ] Updated documentation for users
- [ ] Monitored performance (bitrate, CPU)

---

## Advanced Usage

### Custom Constraint Handling

```javascript
const { toggleScreenShare } = useScreenShare(...);

// The hook already handles constraints internally
// But if you need custom constraints, modify useScreenShare.js

// Find this section:
const screenStream = await navigator.mediaDevices.getDisplayMedia({
  video: {
    cursor: 'always',
    displaySurface: 'monitor',
    logicalSurface: true,
    frameRate: { ideal: 30, max: 30 },
    width: { ideal: 1920, max: 2560 },
    height: { ideal: 1080, max: 1440 }
  },
  audio: false
});

// Modify constraints as needed
```

### Adding Audio Sharing

Not recommended, but if needed:

```javascript
// In useScreenShare.js, change:
const screenStream = await navigator.mediaDevices.getDisplayMedia({
  video: {...},
  audio: true  // ← Enable audio
});

// Note: User must allow audio sharing permission
// Most users won't expect this
```

### Stats Monitoring

Add to your component:

```javascript
const [stats, setStats] = useState(null);

useEffect(() => {
  if (!peerConnectionRef.current) return;

  const intervalId = monitorPeerConnectionStats(
    peerConnectionRef.current,
    (stats) => {
      setStats(stats);
      console.log('Video bitrate:', stats.video.bytesSent / 1000, 'kbps');
    }
  );

  return () => clearInterval(intervalId);
}, []);

// Display stats
{stats && <div>Bitrate: {Math.round(stats.video.bytesSent / 1000)} kbps</div>}
```

---

## Getting Help

If something doesn't work:

1. **Check console for errors**
   - Open DevTools (F12)
   - Look for red errors

2. **Check browser compatibility**
   - Use latest version of Chrome, Firefox, or Safari

3. **Check permissions**
   - Ensure screen sharing allowed in browser settings

4. **Test on different network**
   - Poor network can cause issues

5. **Refer to SCREEN_SHARING_BUGS.md**
   - Most common issues documented there

6. **Enable debug logging**
   - Hook already logs to console
   - Check browser console for detailed info
