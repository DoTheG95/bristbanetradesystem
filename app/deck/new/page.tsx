'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '../../components/Navbar';

export default function NewDeckPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const createDeck = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace('/');
        return;
      }

      const { data, error } = await supabase
        .from('decks')
        .insert({ user_id: session.user.id, name: 'Untitled Deck' })
        .select('id')
        .single();

      if (cancelled) return;

      if (error || !data) {
        console.error('Create deck error:', error);
        setErrorMsg('Failed to create deck. Please try again.');
        return;
      }

      router.replace(`/deck/${data.id}`);
    };

    createDeck();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="ca-page">
      <Navbar />
      <div className="ca-container">
        {errorMsg ? (
          <div className="ca-state-message">
            {errorMsg}
            <div style={{ marginTop: 12 }}>
              <button onClick={() => router.push('/deck')} className="ca-btn ca-btn-ghost ca-btn-md">Back to decks</button>
            </div>
          </div>
        ) : (
          <div className="ca-state-message">Creating deck…</div>
        )}
      </div>
    </div>
  );
}
