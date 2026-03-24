'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function OnboardingPage() {
  const [displayName, setDisplayName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        window.location.replace('/');
        return;
      }

      // If they already have a display_name, skip onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .single();

      if (profile?.display_name) {
        window.location.replace('/main');
        return;
      }

      setUserId(session.user.id);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async () => {
    setError(null);
    const trimmed = displayName.trim();
    if (!trimmed) { setError('Please enter a display name.'); return; }
    if (trimmed.length < 2) { setError('Display name must be at least 2 characters.'); return; }
    if (trimmed.length > 32) { setError('Display name must be under 32 characters.'); return; }

    setLoading(true);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', userId);

    setLoading(false);

    if (updateError) {
      setError('Something went wrong. Please try again.');
      console.error(updateError);
      return;
    }

    window.location.replace('/main');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  if (checking) return null;

  return (
    <div style={styles.page}>
      <div style={styles.orbTopLeft} />
      <div style={styles.orbBottomRight} />

      <main style={styles.main}>
        <div style={styles.card}>

          <div style={styles.header}>
            <h1 style={styles.title}>Welcome 👋</h1>
            <p style={styles.subtitle}>Choose a display name to get started. You can change this later.</p>
          </div>

          <input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={32}
            autoFocus
            style={styles.input}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
          />

          <div style={styles.charCount}>
            {displayName.length}/32
          </div>

          {error && <p style={styles.errorText}>{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ ...styles.btnPrimary, ...(loading ? styles.btnPrimaryDisabled : {}) }}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#5254cc'; }}
            onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#6366f1'; }}
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>

        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    background: '#0d0d0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  orbTopLeft: {
    position: 'absolute',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
    top: '-200px',
    left: '-200px',
    pointerEvents: 'none',
  },
  orbBottomRight: {
    position: 'absolute',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(24,119,242,0.08) 0%, transparent 70%)',
    bottom: '-150px',
    right: '-150px',
    pointerEvents: 'none',
  },
  main: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '420px',
    padding: '24px 16px',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '36px 32px',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 600,
    color: '#ffffff',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.35)',
    margin: 0,
    lineHeight: 1.5,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  charCount: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'right',
    marginTop: '6px',
  },
  errorText: {
    marginTop: '10px',
    fontSize: '13px',
    color: '#f87171',
  },
  btnPrimary: {
    marginTop: '20px',
    width: '100%',
    padding: '13px',
    background: '#6366f1',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  btnPrimaryDisabled: {
    background: 'rgba(99,102,241,0.4)',
    cursor: 'not-allowed',
  },
};