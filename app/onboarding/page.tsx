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
    if (!userId) { setError('Session expired. Please log in again.'); return; }

    setLoading(true);

    // upsert handles both the case where the profiles row doesn't exist yet
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
    <div className="ca-auth-shell">
      <div className="ca-auth-orb ca-auth-orb--tl" />
      <div className="ca-auth-orb ca-auth-orb--br" />

      <main className="ca-auth-main">
        <div className="ca-auth-card">

          <div className="ca-auth-header">
            <h1 className="ca-auth-title">Welcome 👋</h1>
            <p className="ca-auth-subtitle">Choose a display name to get started. You can change this later.</p>
          </div>

          <input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={32}
            autoFocus
            className="ca-auth-input"
          />

          <div className="ca-auth-char-count">
            {displayName.length}/32
          </div>

          {error && <p className="ca-auth-error">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="ca-auth-btn-primary"
            style={{ marginTop: 20 }}
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>

        </div>
      </main>
    </div>
  );
}
