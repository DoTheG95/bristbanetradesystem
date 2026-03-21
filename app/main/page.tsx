'use client';

import React, { useCallback, useEffect, useState } from 'react';
import SearchModal from './SearchModal';
import { getToken, getSession, clearToken, isTokenExpired, type Session } from '@/lib/auth';

export default function MainPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const token = getToken();
    console.log('MainPage: token =', token);
    console.log('MainPage: isExpired =', token ? isTokenExpired(token) : 'n/a');
    console.log('MainPage: session =', token ? getSession() : 'n/a');
  
    if (!token || isTokenExpired(token)) {
      clearToken();
      window.location.replace('/');
      return;
    }
  
    const decoded = getSession();
    if (!decoded) {
      clearToken();
      window.location.replace('/');
      return;
    }
  
    setSession(decoded);
    setChecking(false);
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    window.location.replace('/');
  }, []);

  const openModal = useCallback(() => setShowModal(true), []);
  const closeModal = useCallback(() => setShowModal(false), []);

  const handleAdd = useCallback((val?: any) => {
    console.log('Adding card(s) for user', session?.sub, val);
    closeModal();
  }, [closeModal, session]);

  // Show nothing while checking auth — prevents flash before redirect
  if (checking || !session) return null;

  return (
    <div className="flex min-h-screen flex-col bg-black/5 font-sans">
      <nav className="w-full border-b bg-white/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="text-lg font-semibold">BTS</div>
          <div className="flex items-center gap-3">
            {session.avatar_url && (
              <img
                src={session.avatar_url}
                alt={session.name ?? 'User'}
                className="w-8 h-8 rounded-full object-cover"
              />
            )}
            {session.name && (
              <span className="text-sm text-gray-700">{session.name}</span>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full flex items-center justify-center">
        <div className="w-full max-w-3xl p-16 flex flex-col items-center gap-6">
          <h1 className="text-3xl font-semibold">Main Page</h1>
          <p>Search for Digimon cards here:</p>
          <div className="w-full mt-6 flex justify-center">
            <button
              aria-label="Open add"
              onClick={openModal}
              className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600 text-white shadow hover:bg-indigo-700"
            >
              <span className="text-2xl">+</span>
            </button>
          </div>
          <SearchModal open={showModal} onClose={closeModal} onAdd={handleAdd} />
        </div>
      </main>
    </div>
  );
}