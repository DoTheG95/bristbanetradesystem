'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [success, setSuccess]                 = useState(false);
  const [sessionReady, setSessionReady]       = useState(false);

  // Supabase sends the user here with a token in the URL hash.
  // onAuthStateChange picks it up automatically and establishes a session.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    setError(null);
    if (!password) { setError('Please enter a new password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) setError(updateError.message);
    else setSuccess(true);
  };

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

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '36px 32px', backdropFilter: 'blur(24px)' }}>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#fff' }}>Password updated</h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>You can now log in with your new password.</p>
            <button onClick={() => window.location.replace('/')} style={{ padding: '11px 32px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Back to login
            </button>
          </div>
        ) : !sessionReady ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            Verifying reset link…
          </div>
        ) : (
          <>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#fff' }}>Choose a new password</h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Must be at least 6 characters.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* New password */}
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="New password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  style={{ width: '100%', padding: '12px 44px 12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', padding: 4, display: 'flex', alignItems: 'center' }}>
                  <EyeIcon visible={showPassword} />
                </button>
              </div>

              {/* Confirm password */}
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
            </div>

            {error && <p style={{ marginTop: 12, fontSize: 13, color: '#f87171' }}>{error}</p>}

            <button
              onClick={handleReset}
              disabled={loading}
              style={{ marginTop: 20, width: '100%', padding: 13, borderRadius: 10, border: 'none', background: loading ? 'rgba(99,102,241,0.4)' : '#6366f1', color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}