'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';


export default function OnboardingPage() {
  const [displayName, setDisplayName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

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
    if (!agreedToTerms) { setError('Please agree to the disclaimer to continue.'); return; }
    if (!userId) { setError('Session expired. Please log in again.'); return; }

    setLoading(true);

    // upsert handles both the case where the profiles row doesn't exist yet
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: trimmed, terms_accepted_at: new Date().toISOString() })
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

          <div className="ca-terms-box">
            <p className="ca-terms-title">Before you start trading</p>
            <p className="ca-terms-text">
              Cardboard Addiction is a platform that helps Digimon TCG collectors across
              Australia and New Zealand find and connect with each other. We don&apos;t verify
              listings, facilitate payments, or take part in any trade — we simply help you
              find people who claim to have what you&apos;re looking for.
            </p>
            <ul className="ca-terms-list">
              <li>We are not responsible for failed, incomplete, fraudulent, or unsatisfactory trades between users.</li>
              <li>We don&apos;t verify that a listed card exists, matches its description, or is actually in the seller&apos;s possession.</li>
              <li>All trades are arranged directly between users, at their own risk — you&apos;re responsible for confirming a trader&apos;s legitimacy and the item&apos;s condition before completing a trade.</li>
              <li>We recommend meeting in person where possible, and using secure, trackable methods for remote trades.</li>
            </ul>
          </div>

          <div
            className="ca-terms-check-row"
            onClick={() => setAgreedToTerms(v => !v)}
          >
            <div className={`ca-checkbox${agreedToTerms ? ' is-checked' : ''}`}>
              {agreedToTerms && <span className="ca-checkbox-mark">✓</span>}
            </div>
            <span className="ca-terms-check-label">I have read and agree to the above.</span>
          </div>

          {error && <p className="ca-auth-error">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading || !agreedToTerms}
            className="ca-auth-btn-primary"
            style={{ marginTop: 16 }}
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>

        </div>
      </main>
    </div>
  );
}
