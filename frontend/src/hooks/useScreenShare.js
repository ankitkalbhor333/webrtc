import { useRef, useCallback, useState } from 'react';

/**
 * useScreenShare Hook
 * 
 * Manages screen sharing with replaceTrack strategy (no renegotiation)
 * 
 * Usage:
 * const {
 *   isScreenSharing,
 *   error,
 *   startScreenShare,
 *   stopScreenShare,
 *   toggleScreenShare
 * } = useScreenShare(peerConnection, cameraStream, localVideoRef);
 */
export const useScreenShare = (pc, cameraStream, localVideoRef) => {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState(null);
  
  // Store references
  const screenStreamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const videoSenderRef = useRef(null);

  // Get the camera video track once when component mounts
  const initializeCameraTrack = useCallback(() => {
    if (!cameraStream) return null;
    
    const track = cameraStream.getVideoTracks()[0];
    if (track) {
      cameraTrackRef.current = track;
      console.log('Camera track initialized:', track.id);
    }
    return track;
  }, [cameraStream]);

  // Get the video sender from peer connection
  const getVideoSender = useCallback(() => {
    if (!pc) {
      console.error('No peer connection');
      return null;
    }

    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
    if (sender) {
      videoSenderRef.current = sender;
    }
    return sender;
  }, [pc]);

  // Validate peer connection state
  const validateConnection = useCallback(() => {
    if (!pc) {
      setError('Peer connection not available');
      return false;
    }

    if (pc.connectionState !== 'connected') {
      setError(`Connection not ready: ${pc.connectionState}`);
      return false;
    }

    const sender = getVideoSender();
    if (!sender) {
      setError('No video sender found in connection');
      return false;
    }

    return true;
  }, [pc, getVideoSender]);

  // Main screen sharing start
  const startScreenShare = useCallback(async () => {
    try {
      setError(null);

      // Validate connection first
      if (!validateConnection()) {
        return;
      }

      // Initialize camera track if not done
      if (!cameraTrackRef.current) {
        initializeCameraTrack();
      }

      console.log('Starting screen share...');

      // Get display stream with constraints
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          logicalSurface: true,
          // Constraints - adjust based on network
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: 1920, max: 2560 },
          height: { ideal: 1080, max: 1440 }
        },
        audio: false // Don't share system audio
      });

      // Store reference for cleanup
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      if (!screenTrack) {
        throw new Error('No video track in display stream');
      }

      screenTrackRef.current = screenTrack;
      console.log('Screen track obtained:', screenTrack.id);

      // Get sender for replacement
      const videoSender = getVideoSender();
      if (!videoSender) {
        throw new Error('Video sender not found');
      }

      // CRITICAL: Use replaceTrack instead of addTrack
      // This swaps the track without renegotiation
      try {
        await videoSender.replaceTrack(screenTrack);
        console.log('Track replaced successfully');
      } catch (replaceError) {
        console.error('replaceTrack failed:', replaceError);
        // Clean up on failure
        screenTrack.stop();
        screenStream.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        screenTrackRef.current = null;
        throw replaceError;
      }

      // Update local video preview to show screen
      if (localVideoRef?.current) {
        localVideoRef.current.srcObject = screenStream;
        console.log('Local preview updated to screen');
      }

      // Listen for user clicking browser's "Stop Sharing" button
      screenTrack.onended = async () => {
        console.log('Screen track ended (user clicked stop)');
        await stopScreenShare();
      };

      setIsScreenSharing(true);
      console.log('Screen sharing started successfully');

    } catch (err) {
      console.error('Screen share error:', err);

      // User-friendly error messages
      if (err.name === 'NotAllowedError') {
        setError('Permission denied. Please allow screen sharing.');
      } else if (err.name === 'NotFoundError') {
        setError('No screen or window found to share.');
      } else if (err.name === 'NotSupportedError') {
        setError('Screen sharing not supported in your browser.');
      } else {
        setError(err.message || 'Failed to share screen');
      }
    }
  }, [validateConnection, initializeCameraTrack, getVideoSender, localVideoRef]);

  // Stop screen sharing and restore camera
  const stopScreenShare = useCallback(async () => {
    try {
      setError(null);
      console.log('Stopping screen share...');

      // Get or validate sender
      let videoSender = videoSenderRef.current;
      if (!videoSender) {
        videoSender = getVideoSender();
      }

      if (!videoSender) {
        throw new Error('Video sender not found');
      }

      // Get or initialize camera track
      let cameraTrack = cameraTrackRef.current;
      if (!cameraTrack) {
        cameraTrack = initializeCameraTrack();
      }

      if (!cameraTrack) {
        throw new Error('Camera track not available');
      }

      // Verify camera track is still alive
      if (cameraTrack.readyState !== 'live') {
        throw new Error('Camera track is no longer available');
      }

      // Replace screen track with camera track
      try {
        await videoSender.replaceTrack(cameraTrack);
        console.log('Restored camera track');
      } catch (replaceError) {
        console.error('Failed to restore camera:', replaceError);
        throw replaceError;
      }

      // Update local preview to show camera
      if (localVideoRef?.current && cameraStream) {
        localVideoRef.current.srcObject = cameraStream;
        console.log('Local preview restored to camera');
      }

      // Clean up screen stream
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('Screen track stopped:', track.id);
        });
        screenStreamRef.current = null;
      }

      screenTrackRef.current = null;
      setIsScreenSharing(false);
      console.log('Screen sharing stopped successfully');

    } catch (err) {
      console.error('Error stopping screen share:', err);
      setError(err.message || 'Failed to stop screen sharing');
      
      // Force cleanup on error
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      screenTrackRef.current = null;
      
      // Still update UI state
      setIsScreenSharing(false);
    }
  }, [getVideoSender, initializeCameraTrack, cameraStream, localVideoRef]);

  // Toggle screen sharing on/off
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    console.log('Cleaning up screen share resources...');
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => {
        t.stop();
        console.log('Cleanup: stopped track', t.id);
      });
      screenStreamRef.current = null;
    }

    if (screenTrackRef.current?.onended) {
      screenTrackRef.current.onended = null;
    }

    screenTrackRef.current = null;
    videoSenderRef.current = null;
  }, []);

  return {
    isScreenSharing,
    error,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    cleanup
  };
};
