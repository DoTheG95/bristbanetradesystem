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
    <div className="ca-auth-shell">
      <div className="ca-auth-card" style={{ maxWidth: 400 }}>
        {success ? (
          <div className="ca-text-center">
            <div className="ca-modal-icon">✅</div>
            <h2 className="ca-modal-heading">Password updated</h2>
            <p className="ca-modal-text">You can now log in with your new password.</p>
            <button onClick={() => window.location.replace('/')} className="ca-auth-btn-primary ca-mt-0" style={{ padding: '11px 32px', width: 'auto' }}>
              Back to login
            </button>
          </div>
        ) : !sessionReady ? (
          <div className="ca-text-center" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            Verifying reset link…
          </div>
        ) : (
          <>
            <h2 className="ca-modal-heading ca-modal-heading--tight">Choose a new password</h2>
            <p className="ca-modal-text">Must be at least 6 characters.</p>

            <div className="ca-auth-fields">
              {/* New password */}
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="New password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  className="ca-auth-input ca-auth-input--icon-pad"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1} className="ca-auth-input-icon-btn">
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
                  className="ca-auth-input"
                />
              </div>
            </div>

            {error && <p className="ca-auth-error">{error}</p>}

            <button
              onClick={handleReset}
              disabled={loading}
              className="ca-auth-btn-primary"
              style={{ marginTop: 20 }}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
