'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Tab = 'login' | 'signup';

export default function Home() {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);


  // Reset password modal
  const [showResetModal, setShowResetModal]   = useState(false);
  const [resetEmail, setResetEmail]           = useState('');
  const [resetLoading, setResetLoading]       = useState(false);
  const [resetError, setResetError]           = useState<string | null>(null);
  const [resetSuccess, setResetSuccess]       = useState(false);


  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.replace('/main');
      } else {
        setCheckingSession(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        window.location.replace('/main');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleEmailLogin = async () => {
    setError(null);
    setMessage(null);
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError(signInError.message);
  };

  const handleEmailSignup = async () => {
    setError(null);
    setMessage(null);

    if (!email || !password || !confirmPassword) { setError('Please fill in all fields.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin) + '/main' },    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setMessage('Account created! Check your email to confirm before logging in.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') tab === 'login' ? handleEmailLogin() : handleEmailSignup();
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setError(null);
    setMessage(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSendReset = async () => {
    setResetError(null);
    if (!resetEmail.trim()) { setResetError('Please enter your email address.'); return; }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: window.location.origin + '/reset-password', // create this route to handle the token
    });
    setResetLoading(false);
    if (error) setResetError(error.message);
    else setResetSuccess(true);
  };

  const openResetModal = () => {
    setResetEmail(email); // pre-fill if they already typed their email
    setResetError(null);
    setResetSuccess(false);
    setShowResetModal(true);
  };

  if (checkingSession) return null;

  return (
    <div className="ca-auth-shell">
      <div className="ca-auth-orb ca-auth-orb--tl" />
      <div className="ca-auth-orb ca-auth-orb--br" />

      <main className="ca-auth-main">
        <div className="ca-auth-card">

          {/* Tab switcher */}
          <div className="ca-auth-tabbar">
            {(['login', 'signup'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`ca-auth-tab${tab === t ? ' is-active' : ''}`}
              >
                {t === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          {/* Inputs */}
          <div className="ca-auth-fields">

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="ca-auth-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="ca-auth-input"
            />
            {tab === 'signup' && (
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="ca-auth-input"
              />
            )}
          </div>

          {/* Feedback */}
          {error && <p className="ca-auth-error">{error}</p>}
          {message && <p className="ca-auth-success">{message}</p>}

          {/* Primary CTA */}
          <button
            onClick={tab === 'login' ? handleEmailLogin : handleEmailSignup}
            disabled={loading}
            className="ca-auth-btn-primary"
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create account'}
          </button>


          {tab === 'login' && (
            <p className="ca-auth-forgot" onClick={openResetModal}>
              Forgot your password?
            </p>
          )}
        </div>
        {showResetModal && (
        <div
          onClick={() => setShowResetModal(false)}
          className="ca-auth-modal-overlay"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="ca-auth-modal"
          >
            {!resetSuccess ? (
              <>
                <h2 className="ca-modal-heading ca-modal-heading--tight">Reset your password</h2>
                <p className="ca-modal-text">
                  Enter your email and we'll send you a link to reset your password.
                </p>
                <input
                  type="email" placeholder="Email address"
                  value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendReset()}
                  autoFocus
                  className="ca-auth-input ca-mb-12"
                />
                {resetError && <p className="ca-auth-error ca-mt-0 ca-mb-12">{resetError}</p>}
                <div className="ca-modal-actions">
                  <button
                    onClick={() => setShowResetModal(false)}
                    className="ca-btn ca-btn-ghost ca-flex-1"
                    style={{ padding: '11px', borderRadius: 10, fontSize: 14 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendReset}
                    disabled={resetLoading}
                    className="ca-auth-btn-primary ca-flex-2 ca-mt-0"
                    style={{ padding: '11px' }}
                  >
                    {resetLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                </div>
              </>
            ) : (
              // Success state
              <div className="ca-text-center" style={{ padding: '8px 0' }}>
                <div className="ca-modal-icon">✉️</div>
                <h2 className="ca-modal-heading">Check your email</h2>
                <p className="ca-modal-text" style={{ lineHeight: 1.6 }}>
                  We sent a password reset link to<br />
                  <span className="ca-text-highlight">{resetEmail}</span>
                </p>
                <button
                  onClick={() => setShowResetModal(false)}
                  className="ca-auth-btn-primary ca-mt-0"
                  style={{ padding: '11px 32px', width: 'auto' }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
