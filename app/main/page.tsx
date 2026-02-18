 'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MainPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const logged = localStorage.getItem('bts_logged_in');
    if (logged === '1') {
      setAuthorized(true);
    } else {
      router.replace('/');
    }
  }, [router]);

  const handleLogout = useCallback(() => {
    if (typeof window !== 'undefined') {
      const win: any = window as any;
      const cleanupAndRedirect = () => {
        try {
          localStorage.removeItem('bts_logged_in');
          localStorage.removeItem('bts_profile');
        } catch (e) {
          console.warn('Error clearing localStorage', e);
        }
        router.push('/');
      };

      if (win.FB && typeof win.FB.logout === 'function') {
        try {
          // Avoid calling getLoginStatus on insecure (http) pages.
          // Instead, check the current auth response synchronously.
          const authResponse =
            typeof win.FB.getAuthResponse === 'function'
              ? win.FB.getAuthResponse()
              : null;

          // If an access token is present, call FB.logout; otherwise skip it.
          if (authResponse && authResponse.accessToken) {
            win.FB.logout(() => {
              cleanupAndRedirect();
            });
          } else {
            // No FB session/token available — just cleanup locally.
            cleanupAndRedirect();
          }
        } catch (e) {
          console.warn('FB logout failed', e);
          cleanupAndRedirect();
        }
      } else {
        cleanupAndRedirect();
      }
    } else {
      router.push('/');
    }
  }, [router]);

  if (!authorized) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
      <main className="w-full max-w-3xl p-16 flex flex-col items-center gap-6">
        <h1 className="text-3xl font-semibold">Main Page</h1>
        <p className="text-gray-600">Welcome — you're logged in.</p>
        <button
          onClick={handleLogout}
          className="mt-4 px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600"
        >
          Logout
        </button>
      </main>
    </div>
  );
}
