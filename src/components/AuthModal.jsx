import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import './AuthModal.css';

const AuthModal = ({ onAuthSuccess }) => {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: name.trim() || email.split('@')[0]
          },
          emailRedirectTo: window.location.origin
        }
      });

      if (signUpError) {
        setError(signUpError.message);
      } else if (data?.user) {
        // Check if email confirmation is required
        if (data.session) {
          // Auto-confirmed (email confirmation disabled in Supabase settings)
          setSuccessMessage('Account created! Signing you in...');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setName('');
          setTimeout(() => onAuthSuccess(), 1500);
        } else {
          // Email confirmation required
          setSuccessMessage(
            'Account created! Please check your email inbox (and spam folder) for a verification link to confirm your account. Once confirmed, you can sign in.'
          );
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setName('');
          // Switch to login tab after a delay so user knows to sign in after confirming
          setTimeout(() => setTab('login'), 5000);
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    try {
      setLoading(true);
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (loginError) {
        if (loginError.message === 'Email not confirmed') {
          setError(
            'Your email has not been confirmed yet. Please check your inbox (and spam folder) for the verification email, or try signing up again to resend it.'
          );
        } else {
          setError(loginError.message);
        }
      } else if (data?.user) {
        onAuthSuccess();
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal-content">
        <div className="auth-header">
          <h2>Welcome to PlaceConnect</h2>
          <p>Connect with locals and explore amazing places together</p>
        </div>

        <div className="auth-google-section">
          <button
            type="button"
            className="auth-google-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <span className="auth-google-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" focusable="false">
                <path fill="#EA4335" d="M24 9.5c3.6 0 6.1 1.6 7.5 2.9l5.1-5.1C33.7 4.3 29.2 2.5 24 2.5 14.9 2.5 7.2 7.7 3.5 15.3l6.6 5.1C12 14.2 17.6 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.7h12.6c-.3 2-1.9 5-5.4 7.1l6.6 5.1c3.9-3.6 6.3-9 6.3-15.8z" />
                <path fill="#FBBC05" d="M10.1 28.9a14.9 14.9 0 0 1 0-9.8l-6.6-5.1a22.1 22.1 0 0 0 0 20l6.6-5.1z" />
                <path fill="#34A853" d="M24 46.5c6.1 0 11.2-2 14.9-5.5l-6.6-5.1c-1.8 1.3-4.2 2.2-8.3 2.2-6.4 0-12-4.7-13.9-11.1l-6.6 5.1C7.2 40.3 14.9 46.5 24 46.5z" />
              </svg>
            </span>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>
        </div>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setTab('login');
              setError('');
              setSuccessMessage('');
            }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setTab('signup');
              setError('');
              setSuccessMessage('');
            }}
          >
            Sign Up
          </button>
        </div>

        {tab === 'login' && (
          <form onSubmit={handleEmailLogin} className="auth-form">
            <div className="auth-form-group">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="you@example.com"
                className="auth-input"
                disabled={loading}
              />
            </div>

            <div className="auth-form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="••••••••"
                className="auth-input"
                disabled={loading}
              />
            </div>

            {error && <div className="auth-error">{error}</div>}
            {successMessage && <div className="auth-success">{successMessage}</div>}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {tab === 'signup' && (
          <form onSubmit={handleEmailSignUp} className="auth-form">
            <div className="auth-form-group">
              <label htmlFor="signup-name">Full Name (optional)</label>
              <input
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="Your name"
                className="auth-input"
                disabled={loading}
              />
            </div>

            <div className="auth-form-group">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="you@example.com"
                className="auth-input"
                disabled={loading}
              />
            </div>

            <div className="auth-form-group">
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="At least 6 characters"
                className="auth-input"
                disabled={loading}
              />
            </div>

            <div className="auth-form-group">
              <label htmlFor="signup-confirm">Confirm Password</label>
              <input
                id="signup-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                placeholder="Confirm password"
                className="auth-input"
                disabled={loading}
              />
            </div>

            {error && <div className="auth-error">{error}</div>}
            {successMessage && <div className="auth-success">{successMessage}</div>}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>
        )}

        <p className="auth-disclaimer">
          Sign in with Google or email to join the conversation.
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
