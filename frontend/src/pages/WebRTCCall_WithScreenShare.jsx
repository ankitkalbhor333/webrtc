import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/api.js';
import { useScreenShare } from '../hooks/useScreenShare.js';
import {
  isScreenSharingSupported,
  getErrorMessage,
  monitorPeerConnectionStats,
  stopMediaStream,
  getTrackInfo
} from '../utils/screenShareUtils.js';
import '../styles/webrtc-call.css';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function WebRTCCall({ roomId, onLeave }) {
  // Video refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Connection refs
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteSocketIdRef = useRef(null);

  // ICE candidate management
  const pendingIceCandidatesRef = useRef([]);

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [remoteUser, setRemoteUser] = useState(null);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [hasLocalStream, setHasLocalStream] = useState(false);
  const [userName, setUserName] = useState('');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [connectionState, setConnectionState] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Screen sharing state
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

  // ==================== Video Stream Management ====================

  const attachLocalStream = useCallback(() => {
    const videoEl = localVideoRef.current;
    const stream = localStreamRef.current;
    if (!videoEl || !stream) return;

    videoEl.srcObject = stream;
    videoEl.muted = true;
    videoEl.play().catch(() => {});

    if (!stream.getVideoTracks().length) {
      videoEl.style.display = 'none';
    } else {
      videoEl.style.display = '';
    }
  }, []);

  const attachRemoteStream = useCallback(() => {
    const videoEl = remoteVideoRef.current;
    const stream = remoteStreamRef.current;
    if (!videoEl || !stream) return;

    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }
    videoEl.play().catch(() => {});
    setHasRemoteStream(true);
  }, []);

  useEffect(() => {
    if (hasLocalStream) attachLocalStream();
  }, [hasLocalStream, attachLocalStream]);

  useEffect(() => {
    if (remoteUser) attachRemoteStream();
  }, [remoteUser, attachRemoteStream]);

  // ==================== ICE Candidate Handling ====================

  const flushPendingIceCandidates = async (pc) => {
    const pending = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Failed to add buffered ICE candidate', e);
      }
    }
  };

  const addIceCandidateSafe = async (candidate) => {
    const pc = peerConnectionRef.current;
    if (!pc || !candidate) return;

    if (!pc.remoteDescription) {
      pendingIceCandidatesRef.current.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('Error adding ICE candidate', e);
    }
  };

  const handleRemoteTrack = useCallback(
    (event) => {
      let stream = event.streams?.[0];
      if (!stream) {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        const exists = remoteStreamRef.current
          .getTracks()
          .some((t) => t.id === event.track.id);
        if (!exists) {
          remoteStreamRef.current.addTrack(event.track);
        }
        stream = remoteStreamRef.current;
      } else {
        remoteStreamRef.current = stream;
      }
      attachRemoteStream();
    },
    [attachRemoteStream]
  );

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
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    remoteSocketIdRef.current = null;

    // Clean up screen share resources
    cleanupScreenShare();
  };

  // ==================== Peer Connection Setup ====================

  const createPeerConnection = (targetSocketId) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    pendingIceCandidatesRef.current = [];

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && targetSocketId && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          to: targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = handleRemoteTrack;

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'connected') attachRemoteStream();
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // ==================== Signaling: Offer/Answer ====================

  const initiateCall = async (targetSocketId) => {
    const pc = createPeerConnection(targetSocketId);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit('offer', { to: targetSocketId, offer });
      console.log('Offer sent to', targetSocketId);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleOffer = async (data) => {
    if (!peerConnectionRef.current) {
      const pc = createPeerConnection(data.from);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      peerConnectionRef.current = pc;
    }

    try {
      const pc = peerConnectionRef.current;
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await flushPendingIceCandidates(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit('answer', { to: data.from, answer });
      console.log('Answer sent to', data.from);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (data) => {
    try {
      const pc = peerConnectionRef.current;
      if (pc && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        await flushPendingIceCandidates(pc);
        console.log('Remote answer received and set');
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  // ==================== Main Effect: Socket and Media Setup ====================

  useEffect(() => {
    const name =
      localStorage.getItem('userName') ||
      JSON.parse(localStorage.getItem('user') || '{}')?.username ||
      'Anonymous';

    setUserName(name);

    let cancelled = false;

    const start = async () => {
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        if (cancelled) {
          stopMediaStream(stream);
          return;
        }

        localStreamRef.current = stream;
        setHasLocalStream(true);

        const socket = io(SOCKET_URL, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          if (cancelled) return;
          setIsConnected(true);
          socket.emit('join-call', { roomId, userName: name });
        });

        socket.on('connect_error', (err) => {
          setErrorMsg('Server connection failed: ' + err.message);
        });

        socket.on('room-full', ({ message }) => {
          setErrorMsg(message);
        });

        socket.on('room-joined', ({ isHost: hostRole, participants }) => {
          if (cancelled) return;
          setIsHost(hostRole);

          if (!hostRole && participants.length > 0) {
            const host = participants[0];
            remoteSocketIdRef.current = host.socketId;
            setRemoteUser({
              socketId: host.socketId,
              userName: host.userName,
            });
          }
        });

        socket.on('new-participant', async (participant) => {
          if (cancelled) return;

          remoteSocketIdRef.current = participant.socketId;
          setRemoteUser({
            socketId: participant.socketId,
            userName: participant.userName,
          });

          await initiateCall(participant.socketId);
        });

        socket.on('offer', async (data) => {
          if (cancelled) return;

          remoteSocketIdRef.current = data.from;
          setRemoteUser({
            socketId: data.from,
            userName: data.userName || 'Host',
          });

          await handleOffer(data);
        });

        socket.on('answer', async (data) => {
          if (cancelled) return;
          await handleAnswer(data);
        });

        socket.on('ice-candidate', async (data) => {
          if (cancelled) return;
          await addIceCandidateSafe(data.candidate);
        });

        socket.on('user-left', () => {
          pendingIceCandidatesRef.current = [];
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
          }
          remoteSocketIdRef.current = null;
          remoteStreamRef.current = null;
          setRemoteUser(null);
          setHasRemoteStream(false);
          setConnectionState('');
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        });

        socket.on('disconnect', () => setIsConnected(false));
      } catch (error) {
        setErrorMsg('Camera/mic error: ' + error.message);
      }
    };

    start();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [roomId]);

  // ==================== Media Control Handlers ====================

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      const newState = !isMicOn;
      audioTracks[0].enabled = newState;
      setIsMicOn(newState);
    }
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length > 0) {
      const newState = !isCameraOn;
      videoTracks[0].enabled = newState;
      setIsCameraOn(newState);
    }
  };

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

  const handleLeave = () => {
    cleanup();
    onLeave?.();
  };

  // ==================== UI Rendering ====================

  return (
    <div className="webrtc-call-container">
      {/* Main video section */}
      <div className="video-section">
        <div className="video-wrapper">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="remote-video"
          />
          {!hasRemoteStream && remoteUser && (
            <div className="no-video-placeholder">
              <span>{remoteUser.userName}</span>
              <p>Waiting for video...</p>
            </div>
          )}
        </div>

        {/* Picture-in-Picture local video */}
        <div className="local-video-pip">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            className="local-video"
          />
        </div>
      </div>

      {/* Control panel */}
      <div className="control-panel">
        <div className="user-info">
          <span>{userName}</span>
          {isHost && <span className="host-badge">Host</span>}
          {remoteUser && <span className="remote-user">{remoteUser.userName}</span>}
        </div>

        <div className="controls">
          {/* Microphone toggle */}
          <button
            className={`control-btn ${isMicOn ? 'on' : 'off'}`}
            onClick={toggleMic}
            title={isMicOn ? 'Mute' : 'Unmute'}
            type="button"
          >
            🎤
          </button>

          {/* Camera toggle */}
          <button
            className={`control-btn ${isCameraOn ? 'on' : 'off'}`}
            onClick={toggleCamera}
            title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            type="button"
          >
            📹
          </button>

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

          {/* Leave call */}
          <button
            className="control-btn leave-btn"
            onClick={handleLeave}
            title="Leave call"
            type="button"
          >
            ☎️
          </button>
        </div>

        {/* Status info */}
        <div className="status-info">
          <p>Connection: {connectionState || 'connecting...'}</p>
          {isScreenSharing && <p className="screen-share-active">🖥️ Sharing screen</p>}
        </div>
      </div>

      {/* Error messages */}
      {errorMsg && (
        <div className="error-message">
          <p>{errorMsg}</p>
          <button onClick={() => setErrorMsg('')} type="button">✕</button>
        </div>
      )}

      {screenShareError && (
        <div className="error-message">
          <p>Screen Share: {screenShareError}</p>
          <button onClick={() => {}} type="button">✕</button>
        </div>
      )}
    </div>
  );
}
