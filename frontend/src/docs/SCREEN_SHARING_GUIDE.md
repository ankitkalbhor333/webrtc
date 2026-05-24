# Screen Sharing in WebRTC: Complete Guide

## Part 1: Core Concepts

### How `replaceTrack()` Works Internally

```
┌─────────────────────────────────────────────────────────────┐
│                    RTCPeerConnection                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  RTCRtpSender (manages outgoing media)                      │
│  ├── track: MediaStreamTrack (current)                      │
│  ├── transceiver: RTCRtpTransceiver                         │
│  └── track.onended → handle cleanup                        │
│                                                              │
│  When replaceTrack(newTrack) is called:                     │
│  1. Old track stops being sent over network                │
│  2. New track replaces it                                   │
│  3. NO new SDP negotiation needed                           │
│  4. Receiver sees new video/audio automatically            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### addTrack vs replaceTrack

```
addTrack(track)
├─ Creates new RTCRtpSender
├─ Adds new track to peer connection
├─ REQUIRES renegotiation (new offer/answer needed)
└─ Result: Multiple tracks sent over same connection

replaceTrack(newTrack)
├─ Uses EXISTING RTCRtpSender
├─ Swaps track without creating new sender
├─ NO renegotiation needed
├─ Old track.stop() recommended for cleanup
└─ Result: Only new track sent (old replaced)
```

### Why Avoid Renegotiation?

```
Without replaceTrack (creates new offer/answer):
Camera Stream → Peer Connection → Send Offer → Receive Answer → Screen Stream
                    ↑ DELAY ↑                        ↑ DELAY ↑
              Network latency, signaling overhead, codec renegotiation

With replaceTrack (seamless swap):
Camera → [INSTANT SWAP] → Screen
         (Same SDP, same codec, same connection)
         ↓
    Zero signaling overhead, instant switch
```

## Part 2: Architecture

### Complete Flow Diagram

```
┌──────────────────┐
│  User Clicks     │
│ "Share Screen"   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ getDisplayMedia() →          │
│ Request browser permission   │
└────────┬─────────────────────┘
         │
    YES? │  NO?
    ─────┼──────
    │         └─→ User denied → Show error
    │
    ▼
┌────────────────────────────────────┐
│ Extract video track from stream    │
│ (screenStream.getVideoTracks()[0]) │
└────────┬─────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ Get RTCRtpSender for video track           │
│ (pc.getSenders().find(s =>                 │
│  s.track?.kind === 'video'))               │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ Call replaceTrack(screenTrack)             │
│ • No new offer/answer                      │
│ • Peer receives new video instantly        │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ Listen to screenTrack.onended              │
│ (User stops sharing or clicks "Stop")      │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ Restore original camera track              │
│ replaceTrack(cameraTrack)                  │
│ • Automatic switch back                    │
│ • Same seamless process                    │
└────────────────────────────────────────────┘
```

## Part 3: What RTCRtpSender Actually Does

```
RTCRtpSender Object Structure:
{
  track: MediaStreamTrack,          // Currently being sent
  transceiver: RTCRtpTransceiver,  // Paired with receiver
  rtpParameters: {...},            // Codec settings
  
  Methods:
  ├── replaceTrack(newTrack) → Promise
  │   └─ Atomically replaces track
  ├── getParameters() → RTCRtpSendParameters
  │   └─ Get current codec, bitrate settings
  ├── setParameters(params) → Promise
  │   └─ Adjust bitrate, codec settings
  └── getStats() → Promise<RTCStatsReport>
      └─ Performance metrics
}

Data Flow:
LocalTrack → RTCRtpSender → Encoder → Network → RTCRtpReceiver → Remote Peer
```

### Key Points:

1. **One RTCRtpSender per media kind**: Each peer connection has one sender for video and one for audio
2. **replaceTrack is atomic**: Happens instantly, either fully succeeds or fails
3. **No SDP change**: The offer/answer already established this sender in the initial connection
4. **Track lifecycle**: Old track should be stopped to free resources

## Part 4: Screen Sharing Sequence Diagram

```
Host                     Browser                    Peer
│                            │                       │
├─ Click Share Screen ──────▶│                       │
│                            │                       │
│                      ┌─────▼─────┐                │
│                      │getDisplay  │                │
│                      │ Media()    │                │
│                      │ Permission │                │
│                      │ Dialog     │                │
│                      └─────┬─────┘                │
│                            │                       │
│                      ┌─────▼──────────────────────▶│
│                      │replaceTrack(screen)        │
│                      │(No negotiation)            │
│                      │                            │
│                      └─────┬────────────────────▶│ (receives screen)
│                            │                       │
│                     User stops sharing            │
│                            │                       │
│                      ┌─────▼──────────────────────▶│
│                      │replaceTrack(camera)        │
│                      │(Back to camera)            │
│                      │                            │
│                      └─────┬────────────────────▶│ (receives camera again)
│                            │                       │
```

## Part 5: Important Browser Considerations

### getDisplayMedia() Permission Models

**Chrome/Edge:**
- Shows tab/window/screen selector
- User clicks "Share"
- Stream available immediately

**Firefox:**
- Shows permission + tab selector
- User must allow and select

**Safari:**
- Requires user gesture (click/touch)
- Permission per domain

### Audio Sharing Limitations

```
getDisplayMedia({audio: true}) 
├─ NOT supported in most browsers
├─ Chrome: Permission required for tab audio
├─ Firefox: Requires special user.js flag
├─ Safari: No support
└─ Solution: Keep mic audio separate, don't mix with screen

// Recommended approach:
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: false  // ← Audio not recommended
});
// Keep existing audio track from camera
```

## Part 6: Performance Considerations

### CPU/Bandwidth Impact

```
Camera Stream (typical):
├─ Resolution: 640x480 @ 30fps
├─ Bitrate: 500-1000 kbps
└─ CPU: Low

Screen Share (typical):
├─ Resolution: 1920x1080 @ 30fps
├─ Bitrate: 2500-5000 kbps
└─ CPU: Medium (encoding screen motion)

Mixed (Screen + Audio):
├─ Higher overall bitrate
├─ Both must fit network capacity
└─ May need to reduce resolution or fps
```

### Optimization Tips

```javascript
// 1. Constraint screen dimensions
await navigator.mediaDevices.getDisplayMedia({
  video: {
    cursor: 'always',  // Show cursor
    displaySurface: 'monitor',  // Entire screen
    logicalSurface: true
  }
});

// 2. Check network capacity before switching
if (bandwidth < 3000kbps) {
  alert('Poor connection - screen share may be choppy');
}

// 3. Stop other video tracks
cameraTrack.stop();  // Free resources

// 4. Monitor peer connection stats
pc.getStats().then(report => {
  report.forEach(stats => {
    if (stats.type === 'outbound-rtp' && stats.kind === 'video') {
      console.log('Bitrate:', stats.bytesSent);
    }
  });
});
```

## Part 7: Common Bugs & Solutions

See: SCREEN_SHARING_BUGS.md
