# Screen Sharing - Visual Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WebRTC Screen Sharing System                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOST SIDE (Browser A)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ React Component (WebRTCCall.jsx)                                     │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  useScreenShare Hook (useScreenShare.js)                           │   │
│  │  ├─ toggleScreenShare()  ───┐                                      │   │
│  │  ├─ startScreenShare()    ──┼──────┐                               │   │
│  │  └─ stopScreenShare()     ──┼────┐ │                               │   │
│  │                             │    │ │                               │   │
│  │  Utilities (screenShareUtils.js) │ │                               │   │
│  │  ├─ isScreenSharingSupported()   │ │                               │   │
│  │  ├─ getErrorMessage()            │ │                               │   │
│  │  └─ getDisplayMediaConstraints() │ │                               │   │
│  │                                  │ │                               │   │
│  └──────────────────────────────────┼─┼───────────────────────────────┘   │
│                                     │ │                                    │
│  ┌──────────────────────────────────┼─┼───────────────────────────────┐   │
│  │ navigator.mediaDevices           │ │                               │   │
│  │                                  ▼ ▼                               │   │
│  │ ┌─────────────────────────────────────────────────┐                │   │
│  │ │ getDisplayMedia()                               │                │   │
│  │ │ ↓                                               │                │   │
│  │ │ Browser Permission Dialog                       │                │   │
│  │ │ ┌─────────────────────────────────────────────┐ │                │   │
│  │ │ │ Which screen to share?                      │ │                │   │
│  │ │ │ ☐ Monitor 1                                 │ │                │   │
│  │ │ │ ☑ Chrome Window                             │ │                │   │
│  │ │ │ ☐ Tab 1: Gmail                              │ │                │   │
│  │ │ │ ☐ Tab 2: GitHub                             │ │                │   │
│  │ │ │             [Share] [Cancel]                │ │                │   │
│  │ │ └─────────────────────────────────────────────┘ │                │   │
│  │ │ ↓                                               │                │   │
│  │ │ Returns MediaStream (screen content)           │                │   │
│  │ └─────────────────────────────────────────────────┘                │   │
│  │                     ↓                                              │   │
│  │  RTCRtpSender.replaceTrack() ← MAGIC HAPPENS HERE               │   │
│  │  (No SDP renegotiation!)                                         │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                   ↓                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ RTCPeerConnection                                                │   │
│  │                                                                  │   │
│  │ Before replaceTrack:                                            │   │
│  │ ┌──────────────────┐                                            │   │
│  │ │ RTCRtpSender     │                                            │   │
│  │ │ .track = Camera  │                                            │   │
│  │ └──────────────────┘                                            │   │
│  │         ↓ replaceTrack(screen)                                  │   │
│  │ ┌──────────────────┐                                            │   │
│  │ │ RTCRtpSender     │                                            │   │
│  │ │ .track = Screen  │ ← SAME SENDER, INSTANT SWAP!              │   │
│  │ └──────────────────┘                                            │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                           ↓ (Network)                                   │
└─────────────────────────────────────────────────────────────────────────┘
                            ║
                            ║ WebRTC Connection
                            ║ (Encrypted, P2P)
                            ║
┌─────────────────────────────────────────────────────────────────────────┐
│                         REMOTE SIDE (Browser B)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  RTCPeerConnection                                                      │
│  ├─ RTCRtpReceiver                                                      │
│  │  └─ ontrack event → handles incoming screen video                   │
│  │                                                                      │
│  └─ <video> element displays screen automatically                       │
│                                                                          │
│  No special code needed on receiver!                                    │
│  Just receives the new video track                                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Starting Screen Share

```
User Click "Share Screen"
        │
        ▼
┌─────────────────────────────┐
│ toggleScreenShare()         │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ startScreenShare()               │
│ • Validate connection            │
│ • Validate camera track saved    │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ navigator.mediaDevices           │
│ .getDisplayMedia({...})          │
│                                  │
│ [Browser shows permission dialog] 
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ User selects screen/window       │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ MediaStream received             │
│ ├─ getVideoTracks()[0]           │
│ └─ screenTrack extracted         │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ pc.getSenders()                  │
│ .find(s => s.track?.kind=video)  │
│ ← Get the video sender           │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ await videoSender                │
│ .replaceTrack(screenTrack)       │
│                                  │
│ ⚡ INSTANT SWAP - NO NEGOTIATION 
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ localVideoRef.srcObject =        │
│ screenStream                     │
│ (Update local preview)           │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ screenTrack.onended = () => ...  │
│ (Listen for user browser stop)   │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ setIsScreenSharing(true)         │
│ (Update UI state)                │
└──────────┬───────────────────────┘
           │
           ▼
     ✅ SUCCESS
  Screen sharing active!
```

---

## Data Flow: Stopping Screen Share

```
User Click "Stop Screen" OR Browser "Stop Sharing" Button
        │
        ▼
    Two paths:
    
    Path A: User clicks button    Path B: Browser stop button
    │                             │
    ▼                             ▼
stopScreenShare()          screenTrack.onended fires
│                          │
└──────────────────────┬───┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ stopScreenShare()                │
        └──────────┬───────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────────┐
        │ Get RTCRtpSender                 │
        │ (Same sender from before)        │
        └──────────┬───────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────────┐
        │ Get original cameraTrack         │
        │ (From cameraTrackRef)            │
        └──────────┬───────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────────┐
        │ await videoSender                │
        │ .replaceTrack(cameraTrack)       │
        │                                  │
        │ ⚡ INSTANT SWAP BACK - NO NEGOTIATION
        └──────────┬───────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────────┐
        │ localVideoRef.srcObject =        │
        │ cameraStream                     │
        │ (Restore local preview)          │
        └──────────┬───────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────────┐
        │ screenStream.getTracks()         │
        │ .forEach(t => t.stop())          │
        │ (Clean up screen tracks)         │
        └──────────┬───────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────────┐
        │ setIsScreenSharing(false)        │
        │ (Update UI state)                │
        └──────────┬───────────────────────┘
                   │
                   ▼
              ✅ SUCCESS
         Screen sharing stopped!
        Camera restored automatically!
```

---

## Component Integration Diagram

```
Your App
│
├─ WebRTCCall.jsx (EXISTING - UPDATE THIS)
│  │
│  ├─ State
│  │  ├─ localVideoRef
│  │  ├─ remoteVideoRef
│  │  ├─ peerConnectionRef
│  │  ├─ localStreamRef
│  │  └─ ... other existing state
│  │
│  ├─ useScreenShare Hook ← ADD THIS
│  │  ├─ isScreenSharing
│  │  ├─ error
│  │  ├─ toggleScreenShare()
│  │  └─ cleanup()
│  │
│  ├─ UI
│  │  ├─ Camera Toggle button
│  │  ├─ Microphone Toggle button
│  │  ├─ Share Screen Button ← ADD THIS
│  │  ├─ Leave button
│  │  └─ Error display ← ADD THIS
│  │
│  └─ Effects
│     ├─ useEffect (setup)
│     │  └─ cleanupScreenShare() ← ADD THIS
│     └─ useEffect (onLeave)
│
├─ useScreenShare.js (NEW FILE)
│  └─ Main hook logic
│
└─ screenShareUtils.js (NEW FILE)
   └─ Helper utilities
```

---

## State Management Flow

```
Component State
│
├─ isScreenSharing: boolean
│  ├─ false → Camera active
│  └─ true → Screen active
│
├─ screenShareError: string | null
│  ├─ null → No error
│  └─ "error message" → Show to user
│
└─ (Hook manages internally)
   ├─ cameraTrackRef
   ├─ screenTrackRef
   ├─ screenStreamRef
   ├─ videoSenderRef
   └─ ... other refs

       Action
         │
    ┌────┼────┐
    │         │
toggleScreenShare()
    │         │
isScreenSharing=false    isScreenSharing=true
    │                         │
startScreenShare()        stopScreenShare()
    │                         │
    ▼                         ▼
User clicks                User clicks
"Share Screen"             "Stop Screen"
    │                         │
    └────────────┬────────────┘
                 │
            ✓ State changes
            ✓ Local preview updates
            ✓ Peer receives new track
            ✓ Everything synced
```

---

## RTCRtpSender Lifecycle

```
STEP 1: INITIALIZATION (When peer connection starts)
┌─────────────────────────────────────────────────┐
│ createPeerConnection()                          │
│                                                 │
│ localStream.getTracks().forEach(track => {      │
│   pc.addTrack(track, localStream);              │
│   // RTCRtpSender created here                  │
│ });                                             │
│                                                 │
│ Result:                                         │
│ RTCRtpSender #1 (VIDEO)                         │
│  ├─ .track = camera track                       │
│  └─ Status: sending camera to peer              │
│ RTCRtpSender #2 (AUDIO)                         │
│  ├─ .track = microphone track                   │
│  └─ Status: sending audio to peer               │
└─────────────────────────────────────────────────┘

STEP 2: SCREEN SHARE (replaceTrack called)
┌─────────────────────────────────────────────────┐
│ await videoSender.replaceTrack(screenTrack)     │
│                                                 │
│ RTCRtpSender #1 (VIDEO) - SAME SENDER          │
│  ├─ .track = screen track ← CHANGED            │
│  ├─ .transceiver = same                        │
│  ├─ .rtpParameters = same codec                │
│  └─ Status: sending SCREEN to peer             │
│                                                 │
│ RTCRtpSender #2 (AUDIO) - UNCHANGED            │
│  ├─ .track = microphone track                  │
│  └─ Status: sending audio to peer              │
│                                                 │
│ Network SDP: SAME (no renegotiation!)          │
│ Peer: Sees screen video automatically          │
└─────────────────────────────────────────────────┘

STEP 3: RESTORE CAMERA (replaceTrack again)
┌─────────────────────────────────────────────────┐
│ await videoSender.replaceTrack(cameraTrack)     │
│                                                 │
│ RTCRtpSender #1 (VIDEO) - SAME SENDER          │
│  ├─ .track = camera track ← CHANGED BACK       │
│  └─ Status: sending CAMERA to peer             │
│                                                 │
│ Result: Back to normal video call!             │
└─────────────────────────────────────────────────┘

STEP 4: CLEANUP (On unmount)
┌─────────────────────────────────────────────────┐
│ cleanup()                                       │
│                                                 │
│ RTCRtpSender.track.stop()                       │
│ RTCRtpSender = null                             │
│ RTCPeerConnection.close()                       │
│                                                 │
│ Result: All resources freed                     │
└─────────────────────────────────────────────────┘
```

---

## Error Handling Flow

```
Operation Started
│
├─ Try getDisplayMedia()
│  ├─ NotAllowedError
│  │  └─ User denied permission
│  │     └─ "Permission denied. Allow screen sharing."
│  ├─ NotFoundError
│  │  └─ User closed picker
│  │     └─ "No screen found. Select and try again."
│  ├─ NotSupportedError
│  │  └─ Old browser
│  │     └─ "Screen sharing not supported. Update browser."
│  └─ Other Error
│     └─ Unexpected issue
│        └─ "Failed to share screen: [error]"
│
├─ Try replaceTrack()
│  ├─ Error: No sender
│  │  └─ "No video sender found"
│  ├─ Error: No camera track
│  │  └─ "Camera track not available"
│  ├─ Error: Invalid state
│  │  └─ "Invalid state. Refresh and try again."
│  └─ Error: Other
│     └─ Cleanup and show message
│
└─ Validate peer connection
   ├─ Not connected
   │  └─ "Connection not ready. Wait and try again."
   └─ Other validation
      └─ Show appropriate error
```

---

## Performance Metrics

```
BITRATE CALCULATION
├─ Measure bytesSent over time
├─ Formula: (bytesSent * 8) / duration_seconds = bitrate (bits/sec)
├─ Divide by 1000 for kbps
└─ Example: 500KB sent in 1 second = 4000 kbps

FRAME ANALYSIS
├─ framesSent - Total frames successfully sent
├─ framesDropped - Frames dropped due to CPU/network
├─ Drop ratio = framesDropped / framesSent
├─ Healthy: < 5% dropped
├─ Warning: 5-10% dropped
└─ Critical: > 10% dropped

QUALITY LIMITATIONS
├─ 'none' - Everything optimal
├─ 'cpu' - CPU overloaded, reducing quality
├─ 'bandwidth' - Network limited, reducing bitrate
└─ 'other' - Some other limitation

PACKET LOSS
├─ packetsLost - Network packets lost
├─ Loss ratio = packetsLost / (packetsLost + packetsSent)
├─ Healthy: < 1% loss
├─ Warning: 1-5% loss
└─ Critical: > 5% loss
```

---

## Browser Support Matrix

```
DESKTOP BROWSERS
┌─────────────┬────────────┬──────────────────┐
│ Browser     │ Min Version│ Screen Sharing   │
├─────────────┼────────────┼──────────────────┤
│ Chrome      │ 72.0       │ ✅ Full Support  │
│ Firefox     │ 66.0       │ ✅ Full Support  │
│ Safari      │ 13.0*      │ ✅ Full Support  │
│ Edge        │ 79.0       │ ✅ Full Support  │
│ Opera       │ 59.0       │ ✅ Full Support  │
│ IE 11       │ -          │ ❌ Not Supported │
└─────────────┴────────────┴──────────────────┘
*macOS Monterey (12.0+) required

MOBILE/TABLET
┌─────────────┬──────────────────┐
│ Platform    │ Screen Sharing   │
├─────────────┼──────────────────┤
│ Windows     │ ✅ All Browsers  │
│ macOS       │ ✅ All Browsers  │
│ Linux       │ ✅ Chrome, FF    │
│ Android     │ ⚠️ Limited*      │
│ iOS/iPadOS  │ ❌ Not Supported │
└─────────────┴──────────────────┘
*Android 11+, Chrome only
```

---

## Integration Timeline

```
START: 0 min
│
├─ Read docs: 5 min
│  └─ README.md + QUICK_REFERENCE.md
│
├─ Copy files: 2 min
│  └─ useScreenShare.js + screenShareUtils.js
│
├─ Update component: 15 min
│  ├─ Add imports
│  ├─ Initialize hook
│  ├─ Add button
│  └─ Update cleanup
│
├─ Test basic: 10 min
│  ├─ Check button appears
│  ├─ Click share screen
│  ├─ Select screen
│  └─ Verify screen shows
│
├─ Test stop: 5 min
│  ├─ Click stop button
│  ├─ Verify camera restores
│  └─ Try browser stop
│
├─ Test errors: 10 min
│  ├─ Deny permission
│  ├─ Close picker
│  └─ Try poor network
│
├─ Add styling: 20 min
│  └─ CSS for buttons and states
│
└─ COMPLETE: ~60 minutes
   (Actually much faster for simple integration!)
```

---

## One More Visualization

```
The Magic of replaceTrack()

WITHOUT replaceTrack (WRONG ❌):
┌────────────┐
│   Camera   │
└─────┬──────┘
      │
      ├─→ RTCRtpSender #1
      │
      └─→ RTCRtpSender #2 (new) ← Need NEW SDP offer!
          
      Network path: NEW negotiation needed
      Latency: ~200-500ms
      Complexity: HIGH

WITH replaceTrack (CORRECT ✅):
┌────────────┐         ┌──────────┐
│   Camera   │ ──→ RTCRtpSender │
└────────────┘         │ #1       │
                   [replaceTrack] 
                        │
                    ┌───▼────┐
                    │ Screen │
                    └────────┘
      
      Network path: SAME (no renegotiation)
      Latency: < 50ms
      Complexity: SIMPLE
```

---

**Visual guides complete!** These diagrams help understand the flow and architecture. 📊
