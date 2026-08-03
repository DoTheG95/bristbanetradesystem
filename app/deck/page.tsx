'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '../components/Navbar';
import { Deck, MAX_DIGI_EGG, MAX_NON_EGG, isDigiEgg } from '../components/DeckTypes';

export default function DeckListPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  /* ── auth guard ── */
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        window.location.replace('/');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .single();
      if (!profile?.display_name) {
        window.location.replace('/onboarding');
        return;
      }
      setUserId(session.user.id);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        window.location.replace('/');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ── load decks + card counts ── */
  useEffect(() => {
    if (checking || !userId) return;
    const loadDecks = async () => {
      setLoading(true);
      const { data: deckRows, error } = await supabase
        .from('decks')
        .select('id, name, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error || !deckRows) {
        console.error('Load decks error:', error);
        setDecks([]);
        setLoading(false);
        return;
      }

      const deckIds = deckRows.map(d => d.id);
      const countsByDeck: Record<string, { digiEggCount: number; nonEggCount: number }> = {};

      if (deckIds.length > 0) {
        const { data: cardRows } = await supabase
          .from('deck_cards')
          .select('deck_id, card_type, quantity')
          .in('deck_id', deckIds);

        for (const row of cardRows ?? []) {
          const entry = countsByDeck[row.deck_id] ?? { digiEggCount: 0, nonEggCount: 0 };
          if (isDigiEgg(row.card_type)) entry.digiEggCount += row.quantity ?? 0;
          else entry.nonEggCount += row.quantity ?? 0;
          countsByDeck[row.deck_id] = entry;
        }
      }

      setDecks(deckRows.map(d => ({
        id: d.id,
        name: d.name,
        created_at: d.created_at,
        updated_at: d.updated_at,
        digiEggCount: countsByDeck[d.id]?.digiEggCount ?? 0,
        nonEggCount: countsByDeck[d.id]?.nonEggCount ?? 0,
      })));
      setLoading(false);
    };
    loadDecks();
  }, [checking, userId]);

  const handleCreate = async () => {
    setCreating(true);
    router.push('/deck/new');
  };

  const handleDelete = async (deckId: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    const { error } = await supabase.from('decks').delete().eq('id', deckId);
    if (error) { console.error('Delete deck error:', error); return; }
    setDecks(prev => prev.filter(d => d.id !== deckId));
  };

  if (checking || !userId) return null;

  return (
    <div className="ca-page">
      <Navbar />

      <div className="ca-container">
        <div className="ca-list-header-row">
          <div>
            <h1 className="ca-list-title">My Decks</h1>
            <p className="ca-list-subtitle">Build decks from the Digimon card database — up to {MAX_DIGI_EGG} Digi-Eggs and {MAX_NON_EGG} other cards.</p>
          </div>
          <button onClick={handleCreate} disabled={creating} className="ca-add-cards-btn">
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> {creating ? 'Creating…' : 'New Deck'}
          </button>
        </div>

        {loading ? (
          <div className="ca-state-message">Loading…</div>
        ) : decks.length === 0 ? (
          <div className="ca-empty-state">
            <div className="ca-empty-icon">🃏</div>
            <div className="ca-empty-title">No decks yet.</div>
            <div className="ca-empty-subtitle">Use &ldquo;New Deck&rdquo; above to start building one.</div>
          </div>
        ) : (
          <div className="ca-listview-grid">
            {decks.map(deck => (
              <div key={deck.id} onClick={() => router.push(`/deck/${deck.id}`)} className="ca-deck-card">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(deck.id, deck.name); }}
                  className="ca-deck-card-delete"
                  aria-label="Delete deck"
                >
                  ×
                </button>
                <div className="ca-deck-card-icon">🃏</div>
                <div className="ca-deck-card-name">{deck.name}</div>
                <div className="ca-deck-card-meta">
                  <span>{deck.digiEggCount}/{MAX_DIGI_EGG} Digi-Eggs</span>
                  <span>{deck.nonEggCount}/{MAX_NON_EGG} cards</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
