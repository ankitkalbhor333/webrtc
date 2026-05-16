import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import '../styles/webrtc-landing.css';

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export default function WebRTCLanding({ onLogout, onJoinCall }) {
  const [showHostModal, setShowHostModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const { user, logout } = useAuth();

  useEffect(() => {
    const stored = localStorage.getItem('userName') || user?.username || '';
    if (stored) setUserName(stored);
  }, [user]);

  const saveAndEnter = (roomId) => {
    const name = userName.trim() || user?.username || 'Anonymous';
    localStorage.setItem('roomId', roomId);
    localStorage.setItem('userName', name);
    onJoinCall(roomId);
  };

  const handleHostMeeting = () => {
    saveAndEnter(generateRoomId());
  };

  const handleJoinMeeting = () => {
    const code = joinRoomId.trim().toUpperCase();
    if (!code) {
      alert('Please enter a room code');
      return;
    }
    saveAndEnter(code);
  };

  const handleLogout = () => {
    logout();
    onLogout?.();
  };

  return (
    <div className="webrtc-landing">
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-logo">
            <span className="logo-icon">📹</span>
            <span>Apna Video Call</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
          </div>
          <div className="nav-user">
            {user && (
              <>
                <span className="user-name">Hi, {user.username}</span>
                <button className="logout-btn" onClick={handleLogout} type="button">
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Host or join a <span className="highlight">video meeting</span>
            </h1>
            <p className="hero-subtitle">
              Create a room as host and share the code, or enter a code to join someone
              else&apos;s meeting.
            </p>
            <div className="hero-buttons meeting-actions">
              <button
                className="btn btn-primary"
                onClick={() => setShowHostModal(true)}
                type="button"
              >
                Host a meeting
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowJoinModal(true)}
                type="button"
              >
                Join with code
              </button>
            </div>
          </div>
          <div className="hero-image">
            <div className="phone-mockup">
              <div className="phone-screen">
                <div className="call-preview">
                  <div className="avatar avatar-1">👨</div>
                  <div className="avatar avatar-2">👩</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how-it-works">
        <div className="container">
          <h2>How it works</h2>
          <div className="steps-grid">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Host</h3>
              <p>Click Host a meeting — you get a 6-character room code</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Share</h3>
              <p>Copy the code or invite link and send it to participants</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Join</h3>
              <p>Others enter the same code under Join with code</p>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <h3>Talk</h3>
              <p>Allow camera and mic — you&apos;re connected</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features-section">
        <div className="container">
          <h2>Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎥</div>
              <h3>HD video</h3>
              <p>Clear video and audio via WebRTC</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔗</div>
              <h3>Easy invite</h3>
              <p>Share a short room code or full link</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Login required</h3>
              <p>Only signed-in users can host or join</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Apna Video Call</p>
        </div>
      </footer>

      {showHostModal && (
        <div className="modal-overlay" onClick={() => setShowHostModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowHostModal(false)}
              type="button"
            >
              ✕
            </button>
            <h2>Host a meeting</h2>
            <p className="modal-desc">You will get a room code to share with others.</p>
            <div className="form-group">
              <label>Your display name</label>
              <input
                type="text"
                placeholder="Your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="modal-buttons">
              <button className="btn btn-primary" onClick={handleHostMeeting} type="button">
                Start hosting
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowHostModal(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowJoinModal(false)}
              type="button"
            >
              ✕
            </button>
            <h2>Join a meeting</h2>
            <p className="modal-desc">Enter the room code shared by the host.</p>
            <div className="form-group">
              <label>Your display name</label>
              <input
                type="text"
                placeholder="Your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Room code</label>
              <input
                type="text"
                placeholder="e.g. ABC123"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                className="form-input room-code-input"
                maxLength={12}
              />
            </div>
            <div className="modal-buttons">
              <button className="btn btn-primary" onClick={handleJoinMeeting} type="button">
                Join meeting
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowJoinModal(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


