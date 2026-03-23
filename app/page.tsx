'use client';

import React, { useEffect, useState } from 'react';
import { saveToken, getToken, isTokenExpired } from '@/lib/auth';
import { SpeedInsights } from "@vercel/speed-insights/next"

export default function Home() {
  const [isHovered, setIsHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorParam = params.get('error');

    if (errorParam) {
      setError('Facebook login was cancelled or failed.');
      setReady(true);
      return;
    }

    // Already logged in — go straight to main
    const token = getToken();
    if (!code && token && !isTokenExpired(token)) {
      window.location.replace('/main');
      return;
    }

    if (code) {
      // Clear code from URL so it can't be reused on refresh
      window.history.replaceState({}, '', '/');
      setLoading(true);

      fetch('/api/auth/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri: window.location.origin + '/' }),
      })
        .then((res) => res.json())
        .then(({ token: jwt, error: err }) => {
          if (err || !jwt) throw new Error(err ?? 'No token returned');
          saveToken(jwt);
          // Small delay to guarantee localStorage is written before navigation
          setTimeout(() => {
            window.location.replace('/main');
          }, 100);
        })
        .catch((err) => {
          console.error('Auth error:', err);
          setError(typeof err?.message === 'string' ? err.message : 'Login failed. Please try again.');
          setLoading(false);
          setReady(true);
        });

      return;
    }

    // No code, no token — show the login button
    setReady(true);
  }, []);

  const handleFacebookLogin = () => {
    const appId = process.env.NEXT_PUBLIC_FB_APP_ID!;
    const redirectUri = encodeURIComponent(window.location.origin + '/');
    const scope = encodeURIComponent('public_profile');
    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    window.location.href = url;
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center font-sans"
      style={{
        backgroundImage: "url('/digivice.png')",
        backgroundPosition: 'center 0%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <main className="flex w-full max-w-3xl flex-col items-center justify-center py-32 px-16">
        <div className="flex flex-col items-center gap-6 text-center">

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-md">{error}</p>
          )}

          {loading && (
            <div className="px-6 py-3 text-sm text-gray-500">Signing in…</div>
          )}
            <div className="flex flex-col gap-4 w-full max-w-sm">
                <button
                  onClick={handleFacebookLogin}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '13px 18px',
                    background: isHovered ? '#1a77f2' : '#1877F2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
                    cursor: 'pointer',
                    letterSpacing: '0.01em',
                    boxShadow: isHovered
                      ? '0 4px 16px rgba(24,119,242,0.45)'
                      : '0 2px 8px rgba(24,119,242,0.25)',
                    transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
                    transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                    minWidth: '220px',
                    justifyContent: 'center',
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="white" style={{ flexShrink: 0 }}>
                    <path d="M24 12.073C24 5.406 18.627 0 12 0S0 5.406 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                  </svg>
                  Continue with Facebook
                </button>
            </div>

          {error && (
            <button
              onClick={() => { setError(null); }}
              style={{ fontSize: '13px', color: '#6b7280', cursor: 'pointer', background: 'none', border: 'none' }}
            >
              Try again
            </button>
          )}
        </div>
      </main>
    </div>
  );
}