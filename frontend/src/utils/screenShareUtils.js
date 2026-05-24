/**
 * Screen Sharing Utilities
 * 
 * Helper functions for screen sharing operations
 */

/**
 * Check if browser supports screen sharing
 * @returns {boolean}
 */
export const isScreenSharingSupported = () => {
  return (
    navigator?.mediaDevices?.getDisplayMedia !== undefined
  );
};

/**
 * Get browser user agent
 * @returns {string}
 */
export const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return 'Unknown';
};

/**
 * Get display media constraints based on use case
 * @param {'hd' | 'full-hd' | 'mobile'} quality
 * @returns {DisplayMediaStreamOptions}
 */
export const getDisplayMediaConstraints = (quality = 'hd') => {
  const constraints = {
    video: {
      cursor: 'always',
      displaySurface: 'monitor',
      logicalSurface: true
    },
    audio: false
  };

  switch (quality) {
    case 'full-hd':
      return {
        ...constraints,
        video: {
          ...constraints.video,
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: 1920, max: 2560 },
          height: { ideal: 1080, max: 1440 }
        }
      };

    case 'mobile':
      return {
        ...constraints,
        video: {
          ...constraints.video,
          frameRate: { ideal: 15, max: 15 },
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 }
        }
      };

    case 'hd':
    default:
      return {
        ...constraints,
        video: {
          ...constraints.video,
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        }
      };
  }
};

/**
 * Parse getDisplayMedia error into user-friendly message
 * @param {Error} error
 * @returns {string}
 */
export const getErrorMessage = (error) => {
  if (!error) return 'Unknown error';

  switch (error.name) {
    case 'NotAllowedError':
      return 'Permission denied. You need to allow screen sharing in browser permissions.';
    case 'NotFoundError':
      return 'No screen or window found to share. Please ensure your screen is available.';
    case 'NotSupportedError':
      return 'Screen sharing is not supported in your browser. Try Chrome, Firefox, Edge, or Safari.';
    case 'InvalidStateError':
      return 'Invalid state. Please refresh and try again.';
    case 'TypeError':
      return 'Invalid screen share request. Please try again.';
    case 'AbortError':
      return 'Screen sharing was aborted. Please try again.';
    default:
      return error.message || 'Failed to share screen';
  }
};

/**
 * Verify that RTCRtpSender is valid and ready
 * @param {RTCRtpSender} sender
 * @returns {boolean}
 */
export const isValidRtpSender = (sender) => {
  if (!sender) {
    console.warn('RTCRtpSender is null/undefined');
    return false;
  }

  if (!sender.track) {
    console.warn('RTCRtpSender has no track');
    return false;
  }

  if (sender.track.readyState !== 'live') {
    console.warn('RTCRtpSender track is not live, state:', sender.track.readyState);
    return false;
  }

  return true;
};

/**
 * Verify that MediaStreamTrack is valid
 * @param {MediaStreamTrack} track
 * @returns {boolean}
 */
export const isValidMediaTrack = (track) => {
  if (!track) {
    console.warn('MediaStreamTrack is null/undefined');
    return false;
  }

  if (track.readyState !== 'live') {
    console.warn('MediaStreamTrack is not live, state:', track.readyState);
    return false;
  }

  return true;
};

/**
 * Monitor peer connection stats for troubleshooting
 * @param {RTCPeerConnection} pc
 * @param {Function} onStats - Callback with stats object
 * @returns {number} - intervalId for cleanup
 */
export const monitorPeerConnectionStats = (pc, onStats) => {
  if (!pc) return null;

  const intervalId = setInterval(async () => {
    try {
      const stats = await pc.getStats();
      const statsReport = {};

      stats.forEach(report => {
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          statsReport.video = {
            bytesSent: report.bytesSent,
            packetsSent: report.packetsSent,
            packetsLost: report.packetsLost,
            framesSent: report.framesSent,
            framesDropped: report.framesDropped,
            bytesDropped: report.bytesDropped
          };
        }
        if (report.type === 'outbound-rtp' && report.kind === 'audio') {
          statsReport.audio = {
            bytesSent: report.bytesSent,
            packetsSent: report.packetsSent,
            packetsLost: report.packetsLost
          };
        }
      });

      if (onStats) {
        onStats(statsReport);
      }
    } catch (error) {
      console.error('Error getting stats:', error);
    }
  }, 1000);

  return intervalId;
};

/**
 * Safely stop all tracks in a MediaStream
 * @param {MediaStream} stream
 */
export const stopMediaStream = (stream) => {
  if (!stream) return;

  stream.getTracks().forEach(track => {
    try {
      track.stop();
      console.log(`Track stopped: ${track.kind} (${track.id})`);
    } catch (error) {
      console.error(`Failed to stop track ${track.id}:`, error);
    }
  });
};

/**
 * Get stream constraints based on detected network conditions
 * @param {number} estimatedBandwidth - in kbps
 * @returns {DisplayMediaStreamOptions}
 */
export const getAdaptiveConstraints = (estimatedBandwidth = 5000) => {
  const baseConstraints = {
    video: {
      cursor: 'always',
      displaySurface: 'monitor',
      logicalSurface: true
    },
    audio: false
  };

  // Adjust based on bandwidth
  if (estimatedBandwidth < 1000) {
    // Very poor connection
    return {
      ...baseConstraints,
      video: {
        ...baseConstraints.video,
        frameRate: { ideal: 10, max: 10 },
        width: { ideal: 640, max: 640 },
        height: { ideal: 480, max: 480 }
      }
    };
  } else if (estimatedBandwidth < 2500) {
    // Poor connection
    return {
      ...baseConstraints,
      video: {
        ...baseConstraints.video,
        frameRate: { ideal: 15, max: 15 },
        width: { ideal: 1024, max: 1024 },
        height: { ideal: 768, max: 768 }
      }
    };
  } else if (estimatedBandwidth < 5000) {
    // Medium connection
    return {
      ...baseConstraints,
      video: {
        ...baseConstraints.video,
        frameRate: { ideal: 24, max: 24 },
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 }
      }
    };
  } else {
    // Good connection - full quality
    return getDisplayMediaConstraints('full-hd');
  }
};

/**
 * Format bytes to human readable format
 * @param {number} bytes
 * @returns {string}
 */
export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Check if device has multiple displays
 * Note: Limited browser support for this API
 * @returns {Promise<number>}
 */
export const getDisplayCount = async () => {
  try {
    if (navigator?.getScreenDetails) {
      const screens = await navigator.getScreenDetails?.();
      return screens?.screens?.length || 1;
    }
  } catch (error) {
    console.warn('getScreenDetails not supported:', error);
  }
  return 1;
};

/**
 * Detect if user has chosen to share audio
 * Some browsers allow audio sharing from tabs
 * @param {MediaStream} stream
 * @returns {boolean}
 */
export const hasAudioTrack = (stream) => {
  return stream?.getAudioTracks?.()?.length > 0;
};

/**
 * Get track statistics for debugging
 * @param {MediaStreamTrack} track
 * @returns {Object}
 */
export const getTrackInfo = (track) => {
  if (!track) return null;

  return {
    id: track.id,
    kind: track.kind,
    label: track.label,
    enabled: track.enabled,
    readyState: track.readyState,
    muted: track.muted,
    contentHint: track.contentHint,
    width: track.getSettings?.()?.width,
    height: track.getSettings?.()?.height,
    frameRate: track.getSettings?.()?.frameRate,
    aspectRatio: track.getSettings?.()?.aspectRatio
  };
};
