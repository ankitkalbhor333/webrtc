import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import '../styles/auth.css';

export default function Register({ onSwitchToLogin, onRegisterSuccess }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [localError, setLocalError] = useState('');
  const [validations, setValidations] = useState({
    username: false,
    email: false,
    password: false,
    match: false,
    terms: false,
  });

  const { register, loading, error, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      onRegisterSuccess?.();
    }
  }, [isAuthenticated, onRegisterSuccess]);

  useEffect(() => {
    setValidations({
      username: username.trim().length >= 3,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      password: password.length >= 6,
      match: password && confirmPassword && password === confirmPassword,
      terms: agreeTerms,
    });
  }, [username, email, password, confirmPassword, agreeTerms]);

  const validateForm = () => {
    if (!username.trim()) {
      setLocalError('Username is required');
      return false;
    }

    if (username.trim().length < 3) {
      setLocalError('Username must be at least 3 characters');
      return false;
    }

    if (!email.trim()) {
      setLocalError('Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalError('Please enter a valid email');
      return false;
    }

    if (!password) {
      setLocalError('Password is required');
      return false;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return false;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return false;
    }

    if (!agreeTerms) {
      setLocalError('You must agree to the terms and conditions');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!validateForm()) {
      return;
    }

    const result = await register(username, email, password);

    if (result.success) {
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setAgreeTerms(false);
      onRegisterSuccess?.();
    } else {
      setLocalError(result.error);
    }
  };

  const displayError = localError || error;
  const isFormValid = Object.values(validations).every(Boolean);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create Account</h1>
          <p>Join Apna Video Call and start connecting</p>
        </div>

        {displayError && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            <p>{displayError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-with-validation">
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                disabled={loading}
                className="form-input"
              />
              {username && (
                <span className={`validation-icon ${validations.username ? 'valid' : 'invalid'}`}>
                  {validations.username ? '✓' : '✗'}
                </span>
              )}
            </div>
            {username && !validations.username && (
              <small className="validation-text">
                Username must be at least 3 characters
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-with-validation">
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={loading}
                className="form-input"
              />
              {email && (
                <span className={`validation-icon ${validations.email ? 'valid' : 'invalid'}`}>
                  {validations.email ? '✓' : '✗'}
                </span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper input-with-validation">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                disabled={loading}
                className="form-input"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
              {password && (
                <span className={`validation-icon ${validations.password ? 'valid' : 'invalid'}`}>
                  {validations.password ? '✓' : '✗'}
                </span>
              )}
            </div>
            {password && !validations.password && (
              <small className="validation-text">
                Password must be at least 6 characters
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input-wrapper input-with-validation">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                disabled={loading}
                className="form-input"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
              >
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </button>
              {confirmPassword && (
                <span className={`validation-icon ${validations.match ? 'valid' : 'invalid'}`}>
                  {validations.match ? '✓' : '✗'}
                </span>
              )}
            </div>
          </div>

          <label className="checkbox-label terms-label">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              disabled={loading}
            />
            <span>
              I agree to the{' '}
              <a href="#terms" target="_blank" rel="noopener noreferrer">
                Terms & Conditions
              </a>{' '}
              and{' '}
              <a href="#privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            </span>
          </label>

          <button
            type="submit"
            className="auth-button"
            disabled={loading || !isFormValid}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="social-login">
          <button className="social-button google" disabled={loading}>
            <span>🔵</span> Sign up with Google
          </button>
          <button className="social-button github" disabled={loading}>
            <span>⚫</span> Sign up with GitHub
          </button>
        </div>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <button
              type="button"
              className="switch-auth-button"
              onClick={onSwitchToLogin}
              disabled={loading}
            >
              Login here
            </button>
          </p>
        </div>
      </div>

      <div className="auth-decoration">
        <div className="decoration-blob blob-1"></div>
        <div className="decoration-blob blob-2"></div>
        <div className="decoration-blob blob-3"></div>
      </div>
    </div>
  );
}
