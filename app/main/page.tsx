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

  const [showModal, setShowModal] = useState(false);
  const [modalText, setModalText] = useState('');

  const openModal = useCallback(() => setShowModal(true), []);
  const closeModal = useCallback(() => setShowModal(false), []);

  const handleAdd = useCallback(() => {
    console.log(modalText);
    setModalText('');
    closeModal();
  }, [modalText, closeModal]);

  if (!authorized) return null;

  return (
    <div className="flex min-h-screen flex-col bg-black/5 font-sans">
      <nav className="w-full border-b bg-white/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="text-lg font-semibold">BTS</div>
          <div>
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full flex items-center justify-center">
        <div className="w-full max-w-3xl p-16 flex flex-col items-center gap-6">
          <h1 className="text-3xl font-semibold">Main Page</h1>
          <p >Search for Digimon cards here:</p>

          <div className="w-full mt-6 flex justify-center">
            <button
              aria-label="Open add"
              onClick={openModal}
              className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600 text-white shadow hover:bg-indigo-700"
            >
              <span className="text-2xl">+</span>
            </button>
          </div>

          {showModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={closeModal}
            >
              <div
                className="w-full max-w-md bg-white rounded-lg p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg text-black font-medium mb-3">Add Search</h2>
                <input
                  value={modalText}
                  onChange={(e) => setModalText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                  }}
                  aria-label="Add search input"
                  placeholder="Type to search..."
                  className="w-full text-black px-3 py-2 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />

                <div className="flex justify-end gap-3">  
                  <button
                    onClick={handleAdd}
                    className="px-3 py-1 rounded bg-indigo-500 text-white hover:bg-indigo-700"
                  >
                    Add
                  </button>
                  <button
                    onClick={closeModal}
                    className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-700"
                  >
                    Cancel
                  </button>
                
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
