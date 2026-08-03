'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Tab = 'login' | 'signup';

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="3" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M7 10V7a5 5 0 0 1 10 0v3" />
  </svg>
);

const EyeIcon = ({ visible }: { visible: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {visible ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

export default function Home() {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    setShowPassword(false);
    setShowConfirmPassword(false);
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
    <div className="ca-landing-shell">
      <div className="ca-landing-orb ca-landing-orb--tl" />
      <div className="ca-landing-orb ca-landing-orb--br" />

      <main className="ca-landing-main">
        {/* Hero / product intro */}
        <div className="ca-landing-hero">
          <span className="ca-landing-badge">🌏 Built for the AUNZ community</span>
          <h1 className="ca-landing-title">
            Cardboard <span className="ca-landing-title-accent">Addiction</span>
          </h1>
          <p className="ca-landing-slogan">A marketplace for the Digimon community in AUNZ.</p>
          <p className="ca-landing-copy">
            Track your wishlist and trade pile, get matched with nearby Tamers, and
            keep your decks organised — one home base for buying, selling and
            trading Digimon cards across Australia and New Zealand.
          </p>

          <div className="ca-landing-features">
            <div className="ca-landing-feature">
              <div className="ca-landing-feature-icon">🔁</div>
              <div>
                <p className="ca-landing-feature-title">Smart trade matching</p>
                <p className="ca-landing-feature-text">Find traders whose trade pile fills your wishlist, and vice versa.</p>
              </div>
            </div>
            <div className="ca-landing-feature">
              <div className="ca-landing-feature-icon">📍</div>
              <div>
                <p className="ca-landing-feature-title">Local first</p>
                <p className="ca-landing-feature-text">Discover Tamers and meetups near you across AU and NZ.</p>
              </div>
            </div>
            <div className="ca-landing-feature">
              <div className="ca-landing-feature-icon">🗂️</div>
              <div>
                <p className="ca-landing-feature-title">Deck building</p>
                <p className="ca-landing-feature-text">Build, save and share decks alongside your collection.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth card */}
        <div className="ca-landing-auth-col">
          <div className="ca-landing-art-glow" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/digivice.png" alt="" aria-hidden="true" className="ca-landing-art-img" />
          <div className="ca-auth-card">

          {/* Header */}
          <div className="ca-auth-header">
            <h2 className="ca-auth-title">{tab === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="ca-auth-subtitle">
              {tab === 'login'
                ? 'Log in to keep trading with your local Digimon community.'
                : 'Join Tamers across AU & NZ trading, matching and building decks.'}
            </p>
          </div>

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

            <div className="ca-auth-input-wrap">
              <span className="ca-auth-input-icon-left"><MailIcon /></span>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                className="ca-auth-input ca-auth-input--icon-left"
              />
            </div>

            <div className="ca-auth-input-wrap">
              <span className="ca-auth-input-icon-left"><LockIcon /></span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="ca-auth-input ca-auth-input--icon-left ca-auth-input--icon-pad"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="ca-auth-input-icon-btn"
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>

            {tab === 'login' && (
              <p className="ca-auth-forgot ca-auth-forgot--inline" onClick={openResetModal}>
                Forgot your password?
              </p>
            )}

            {tab === 'signup' && (
              <div className="ca-auth-input-wrap">
                <span className="ca-auth-input-icon-left"><LockIcon /></span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="ca-auth-input ca-auth-input--icon-left ca-auth-input--icon-pad"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="ca-auth-input-icon-btn"
                >
                  <EyeIcon visible={showConfirmPassword} />
                </button>
              </div>
            )}
          </div>

          {/* Feedback */}
          {error && <p className="ca-auth-error">{error}</p>}
          {message && <p className="ca-auth-success">{message}</p>}

          {/* Primary CTA — pinned to the bottom of the card so it lands in the same spot on both tabs */}
          <div className="ca-auth-actions">
            <button
              onClick={tab === 'login' ? handleEmailLogin : handleEmailSignup}
              disabled={loading}
              className="ca-auth-btn-primary"
            >
              {loading ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create account'}
            </button>
          </div>
          </div>
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
