'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Tab = 'login' | 'signup';

export default function Home() {
  const [tab, setTab]                         = useState<Tab>('login');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accessCode, setAccessCode]           = useState('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [message, setMessage]                 = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Password visibility
  const [showPassword, setShowPassword]               = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reset password modal
  const [showResetModal, setShowResetModal]   = useState(false);
  const [resetEmail, setResetEmail]           = useState('');
  const [resetLoading, setResetLoading]       = useState(false);
  const [resetError, setResetError]           = useState<string | null>(null);
  const [resetSuccess, setResetSuccess]       = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.replace('/main');
      else setCheckingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) window.location.replace('/main');
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleEmailLogin = async () => {
    setError(null); setMessage(null);
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError(signInError.message);
  };

  const handleEmailSignup = async () => {
    setError(null); setMessage(null);
    const validCode = process.env.NEXT_PUBLIC_ACCESS_CODE;
    if (!accessCode) { setError('Please enter the access code.'); return; }
    if (accessCode.trim() !== validCode) { setError('Invalid access code.'); return; }
    if (!email || !password || !confirmPassword) { setError('Please fill in all fields.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + '/main' },
    });
    setLoading(false);
    if (signUpError) setError(signUpError.message);
    else setMessage('Account created! Check your email to confirm before logging in.');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') tab === 'login' ? handleEmailLogin() : handleEmailSignup();
  };

  const switchTab = (t: Tab) => {
    setTab(t); setError(null); setMessage(null);
    setEmail(''); setPassword(''); setConfirmPassword(''); setAccessCode('');
    setShowPassword(false); setShowConfirmPassword(false);
  };

  const openResetModal = () => {
    setResetEmail(email); // pre-fill if they already typed their email
    setResetError(null);
    setResetSuccess(false);
    setShowResetModal(true);
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

  if (checkingSession) return null;

  // ── Eye icon SVG ──────────────────────────────────────────────────────────
  const EyeIcon = ({ visible }: { visible: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {visible ? (
        // Eye-off (hide)
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        // Eye (show)
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );

  // ── Password field with eye toggle ───────────────────────────────────────
  const PasswordField = ({
    placeholder, value, onChange, show, onToggle,
  }: {
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    show: boolean;
    onToggle: () => void;
  }) => (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{ ...styles.input, paddingRight: '44px' }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
      />
      <button
        type="button"
        onClick={onToggle}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
        tabIndex={-1}
      >
        <EyeIcon visible={show} />
      </button>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.orbTopLeft} />
      <div style={styles.orbBottomRight} />

      <main style={styles.main}>
        <div style={styles.card}>

          {/* Tab switcher */}
          <div style={styles.tabBar}>
            {(['login', 'signup'] as Tab[]).map(t => (
              <button key={t} onClick={() => switchTab(t)} style={{ ...styles.tabBtn, ...(tab === t ? styles.tabBtnActive : {}) }}>
                {t === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          {/* Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {tab === 'signup' && (
              <div>
                <input
                  type="text" placeholder="Access code" value={accessCode}
                  onChange={e => setAccessCode(e.target.value)} onKeyDown={handleKeyDown}
                  style={styles.input}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
                <p style={styles.fieldHint}>Early access only — enter your invite code</p>
              </div>
            )}

            <input
              type="email" placeholder="Email address" value={email}
              onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown}
              style={styles.input}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
            />

            <PasswordField
              placeholder="Password" value={password}
              onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(v => !v)}
            />

            {tab === 'signup' && (
              <PasswordField
                placeholder="Confirm password" value={confirmPassword}
                onChange={setConfirmPassword} show={showConfirmPassword} onToggle={() => setShowConfirmPassword(v => !v)}
              />
            )}
          </div>

          {error   && <p style={styles.errorText}>{error}</p>}
          {message && <p style={styles.successText}>{message}</p>}

          <button
            onClick={tab === 'login' ? handleEmailLogin : handleEmailSignup}
            disabled={loading}
            style={{ ...styles.btnPrimary, ...(loading ? styles.btnPrimaryDisabled : {}) }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#5254cc'; }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#6366f1'; }}
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create account'}
          </button>

          {tab === 'login' && (
            <p style={styles.passwordReset} onClick={openResetModal}>
              Forgot your password?
            </p>
          )}
        </div>
      </main>

      {/* ── Reset password modal ── */}
      {showResetModal && (
        <div
          onClick={() => setShowResetModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 400, background: 'rgba(20,20,24,0.98)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 28px', backdropFilter: 'blur(24px)', animation: 'resetIn 0.18s ease', fontFamily: "'Inter', -apple-system, sans-serif" }}
          >
            {!resetSuccess ? (
              <>
                <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#fff' }}>Reset your password</h2>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                  Enter your email and we'll send you a link to reset your password.
                </p>
                <input
                  type="email" placeholder="Email address"
                  value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendReset()}
                  autoFocus
                  style={{ ...styles.input, marginBottom: 12 }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
                {resetError && <p style={{ ...styles.errorText, marginTop: 0, marginBottom: 12 }}>{resetError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setShowResetModal(false)}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendReset}
                    disabled={resetLoading}
                    style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: resetLoading ? 'rgba(99,102,241,0.4)' : '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: resetLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}
                    onMouseEnter={e => { if (!resetLoading) (e.currentTarget as HTMLButtonElement).style.background = '#5254cc'; }}
                    onMouseLeave={e => { if (!resetLoading) (e.currentTarget as HTMLButtonElement).style.background = '#6366f1'; }}
                  >
                    {resetLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                </div>
              </>
            ) : (
              // Success state
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
                <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#fff' }}>Check your email</h2>
                <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                  We sent a password reset link to<br />
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{resetEmail}</span>
                </p>
                <button
                  onClick={() => setShowResetModal(false)}
                  style={{ padding: '11px 32px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes resetIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: 'relative', minHeight: '100vh', background: '#0d0d0f',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  orbTopLeft: {
    position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
    top: '-200px', left: '-200px', pointerEvents: 'none',
  },
  orbBottomRight: {
    position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(24,119,242,0.08) 0%, transparent 70%)',
    bottom: '-150px', right: '-150px', pointerEvents: 'none',
  },
  main: { position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px', padding: '24px 16px' },
  card: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px', padding: '36px 32px',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    display: 'flex', flexDirection: 'column', gap: '0px',
  },
  tabBar: {
    display: 'flex', background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px', padding: '4px', marginBottom: '24px',
  },
  tabBtn: {
    flex: 1, padding: '9px', fontSize: '14px', fontWeight: 500, border: 'none',
    borderRadius: '7px', cursor: 'pointer', background: 'transparent',
    color: 'rgba(255,255,255,0.35)', fontFamily: 'inherit', transition: 'all 0.2s',
  },
  tabBtnActive: { background: 'rgba(255,255,255,0.10)', color: '#ffffff' },
  input: {
    width: '100%', padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', color: '#ffffff', fontSize: '14px',
    fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
  },
  fieldHint: { fontSize: '11px', color: 'rgba(255,255,255,0.2)', margin: '6px 0 0 2px' },
  passwordReset: {
    fontSize: '13px', color: 'rgba(255,255,255,0.3)', margin: '14px 0 0',
    cursor: 'pointer', textAlign: 'center', transition: 'color 0.2s',
  },
  errorText:   { marginTop: '10px', fontSize: '13px', color: '#f87171' },
  successText: { marginTop: '10px', fontSize: '13px', color: '#4ade80' },
  btnPrimary: {
    marginTop: '16px', width: '100%', padding: '13px', background: '#6366f1',
    color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '15px',
    fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'background 0.2s',
  },
  btnPrimaryDisabled: { background: 'rgba(99,102,241,0.4)', cursor: 'not-allowed' },
};