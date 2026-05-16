import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import '../styles/webrtc-call.css';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function WebRTCCall({ roomId, onLeave }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteSocketIdRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const isHostRef = useRef(false);
  const initRef = useRef(false);

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
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    remoteSocketIdRef.current = null;
    isHostRef.current = false;
    initRef.current = false;
  };

  useEffect(() => {
    const name =
      localStorage.getItem('userName') ||
      JSON.parse(localStorage.getItem('user') || '{}')?.username ||
      'Anonymous';

    setUserName(name);

    if (initRef.current) return;
    initRef.current = true;

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
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setHasLocalStream(true);

        const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', {
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
          isHostRef.current = hostRole;
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
          if (cancelled || !isHostRef.current) return;

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

  const addLocalTracks = (pc) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      const already = pc.getSenders().some((s) => s.track?.id === track.id);
      if (!already) pc.addTrack(track, stream);
    });
  };

  const initiateCall = async (targetSocketId) => {
    try {
      const pc = createPeerConnection(targetSocketId);
      addLocalTracks(pc);

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);

      socketRef.current.emit('offer', {
        to: targetSocketId,
        offer: pc.localDescription,
      });
    } catch (error) {
      console.error('Error initiating call:', error);
      setErrorMsg('Failed to start call');
    }
  };

  const handleOffer = async (data) => {
    try {
      const pc = createPeerConnection(data.from);

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await flushPendingIceCandidates(pc);

      addLocalTracks(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit('answer', {
        to: data.from,
        answer: pc.localDescription,
      });
    } catch (error) {
      console.error('Error handling offer:', error);
      setErrorMsg('Failed to connect to host');
    }
  };

  const handleAnswer = async (data) => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      await flushPendingIceCandidates(pc);
      attachRemoteStream();
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMicOn((p) => !p);
  };

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsCameraOn((p) => !p);
  };

  const endCall = () => {
    cleanup();
    onLeave?.();
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert('Room ID copied!');
  };

  const shareLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/call/${roomId}`);
    alert('Meeting link copied!');
  };

  const remoteLabel = remoteUser?.userName || (isHost ? 'Guest' : 'Host');

  return (
    <div className="webrtc-call-container">
      <div className="call-header">
        <div>
          <h2>{isHost ? 'Hosting' : 'In meeting'}</h2>
          <p className="call-subtitle">{userName}</p>
        </div>
        <div className="room-info">
          <span className="role-badge">{isHost ? 'Host' : 'Guest'}</span>
          <span>Room: {roomId}</span>
          <button className="copy-btn" onClick={copyRoomId} type="button">Copy ID</button>
          <button className="copy-btn" onClick={shareLink} type="button">Copy link</button>
        </div>
      </div>

      {errorMsg && <div className="call-error">{errorMsg}</div>}

      <div className="videos-container">
        <div className="video-wrapper local-video">
          <video ref={localVideoRef} autoPlay muted playsInline className="video-element" />
          {!hasLocalStream && (
            <div className="waiting-overlay">
              <div className="spinner" />
              <p>Starting camera...</p>
            </div>
          )}
          <div className="video-label">You ({userName})</div>
        </div>

        <div className={`video-wrapper remote-video ${!hasRemoteStream ? 'remote-video-pending' : ''}`}>
          <video ref={remoteVideoRef} autoPlay playsInline className="video-element" />
          {!hasRemoteStream && (
            <div className="waiting-overlay">
              <div className="spinner" />
              <p>
                {remoteUser
                  ? `Connecting to ${remoteLabel}...`
                  : isHost
                    ? 'Waiting for guest to join...'
                    : 'Waiting for host...'}
              </p>
              {isHost && !remoteUser && (
                <>
                  <p className="share-text">Share room code:</p>
                  <div className="share-box"><code>{roomId}</code></div>
                </>
              )}
            </div>
          )}
          {(remoteUser || hasRemoteStream) && (
            <div className="video-label">{remoteLabel}</div>
          )}
        </div>
      </div>

      <div className="controls-container">
        <button className={`control-btn ${isMicOn ? 'active' : ''}`} onClick={toggleMic} type="button">
          {isMicOn ? '🎤' : '🔇'}
        </button>
        <button className={`control-btn ${isCameraOn ? 'active' : ''}`} onClick={toggleCamera} type="button">
          {isCameraOn ? '📹' : '🚫'}
        </button>
        <button className="control-btn end-call" onClick={endCall} type="button">📞</button>
      </div>

      <div className="status-bar">
        <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '● Disconnected'}
        </span>
        {remoteUser && <span className="status">● With {remoteUser.userName}</span>}
        {connectionState && <span className="status">● {connectionState}</span>}
        {hasRemoteStream && <span className="status">● Remote video active</span>}
      </div>
    </div>
  );
}

