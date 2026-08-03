'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '../../components/Navbar';
import DeckSearchBar from '../../components/DeckSearchBar';
import DeckGridCard from '../../components/DeckGridCard';
import { DeckCard, DeckSearchResult, MAIN_DECK_TYPE_ORDER, MAX_DIGI_EGG, MAX_NON_EGG, getMaxCopies, isDigiEgg } from '../../components/DeckTypes';

export default function DeckBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params?.deckId as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const [deckName, setDeckName] = useState('');
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [deckLoading, setDeckLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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

  /* ── load deck + cards ── */
  useEffect(() => {
    if (checking || !userId || !deckId) return;
    const loadDeck = async () => {
      setDeckLoading(true);

      const { data: deckRow, error: deckError } = await supabase
        .from('decks')
        .select('id, name')
        .eq('id', deckId)
        .eq('user_id', userId)
        .maybeSingle();

      if (deckError || !deckRow) {
        setNotFound(true);
        setDeckLoading(false);
        return;
      }

      setDeckName(deckRow.name);

      const { data: cardRows, error: cardsError } = await supabase
        .from('deck_cards')
        .select('id, tcgplayer_id, tcgplayer_name, card_number, rarity, card_type, level, quantity')
        .eq('deck_id', deckId)
        .order('sort_order', { ascending: true });

      if (cardsError) console.error('Load deck cards error:', cardsError);

      setCards((cardRows ?? []).map(c => ({
        id: c.id,
        tcgplayer_id: String(c.tcgplayer_id),
        tcgplayer_name: c.tcgplayer_name ?? '',
        card_number: c.card_number ?? '',
        rarity: c.rarity ?? null,
        card_type: c.card_type ?? null,
        level: c.level ?? null,
        quantity: c.quantity ?? 1,
      })));
      setDeckLoading(false);
      setIsDirty(false);
    };
    loadDeck();
  }, [checking, userId, deckId]);

  /* ── warn on tab close / refresh with unsaved changes ── */
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const digiEggCount = cards.filter(c => isDigiEgg(c.card_type)).reduce((sum, c) => sum + c.quantity, 0);
  const nonEggCount = cards.filter(c => !isDigiEgg(c.card_type)).reduce((sum, c) => sum + c.quantity, 0);

  const isFull = useCallback((cardType: string | null) => (
    isDigiEgg(cardType) ? digiEggCount >= MAX_DIGI_EGG : nonEggCount >= MAX_NON_EGG
  ), [digiEggCount, nonEggCount]);

  const copiesOfCardNumber = useCallback((cardNumber: string) => (
    cards.filter(c => c.card_number === cardNumber).reduce((sum, c) => sum + c.quantity, 0)
  ), [cards]);

  const atCopyLimit = useCallback((cardNumber: string) => (
    copiesOfCardNumber(cardNumber) >= getMaxCopies(cardNumber)
  ), [copiesOfCardNumber]);

  const isAdded = useCallback((tcgplayerId: string) => cards.some(c => c.tcgplayer_id === tcgplayerId), [cards]);

  const canAddCard = useCallback((card: DeckSearchResult) => (
    !isFull(card.card_type) && !atCopyLimit(card.card_number)
  ), [isFull, atCopyLimit]);

  const handleAddCard = useCallback((card: DeckSearchResult) => {
    if (!canAddCard(card)) return;
    setCards(prev => {
      const existing = prev.find(c => c.tcgplayer_id === card.tcgplayer_id);
      if (existing) {
        return prev.map(c => c.tcgplayer_id === card.tcgplayer_id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        id: crypto.randomUUID(),
        tcgplayer_id: card.tcgplayer_id,
        tcgplayer_name: card.tcgplayer_name,
        card_number: card.card_number,
        rarity: card.rarity,
        card_type: card.card_type,
        level: card.level,
        quantity: 1,
      }];
    });
    setIsDirty(true);
    setSaveMsg(null);
  }, [canAddCard]);

  const handleIncrement = useCallback((id: string) => {
    setCards(prev => {
      const target = prev.find(c => c.id === id);
      if (!target || isFull(target.card_type) || atCopyLimit(target.card_number)) return prev;
      return prev.map(c => c.id === id ? { ...c, quantity: c.quantity + 1 } : c);
    });
    setIsDirty(true);
    setSaveMsg(null);
  }, [isFull, atCopyLimit]);

  const handleDecrement = useCallback((id: string) => {
    setCards(prev => {
      const target = prev.find(c => c.id === id);
      if (!target) return prev;
      return target.quantity <= 1
        ? prev.filter(c => c.id !== id)
        : prev.map(c => c.id === id ? { ...c, quantity: c.quantity - 1 } : c);
    });
    setIsDirty(true);
    setSaveMsg(null);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    setIsDirty(true);
    setSaveMsg(null);
  }, []);

  const handleSortMainDeck = useCallback(() => {
    setCards(prev => {
      const egg = prev.filter(c => isDigiEgg(c.card_type));
      const main = prev.filter(c => !isDigiEgg(c.card_type));
      const sortedMain = [...main].sort((a, b) => {
        const typeCmp = (MAIN_DECK_TYPE_ORDER[a.card_type ?? ''] ?? 99) - (MAIN_DECK_TYPE_ORDER[b.card_type ?? ''] ?? 99);
        if (typeCmp !== 0) return typeCmp;
        if (a.card_type === 'Digimon') {
          const levelCmp = (a.level ?? 0) - (b.level ?? 0);
          if (levelCmp !== 0) return levelCmp;
        }
        return a.tcgplayer_name.localeCompare(b.tcgplayer_name);
      });
      return [...sortedMain, ...egg];
    });
    setIsDirty(true);
    setSaveMsg(null);
  }, []);

  const handleNameChange = (value: string) => {
    setDeckName(value);
    setIsDirty(true);
    setSaveMsg(null);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const { error: deckError } = await supabase
        .from('decks')
        .update({ name: deckName, updated_at: new Date().toISOString() })
        .eq('id', deckId);
      if (deckError) throw deckError;

      const { error: deleteError } = await supabase.from('deck_cards').delete().eq('deck_id', deckId);
      if (deleteError) throw deleteError;

      if (cards.length > 0) {
        const rows = cards.map((c, index) => ({
          deck_id: deckId,
          tcgplayer_id: c.tcgplayer_id,
          tcgplayer_name: c.tcgplayer_name,
          card_number: c.card_number,
          rarity: c.rarity,
          card_type: c.card_type,
          level: c.level,
          quantity: c.quantity,
          sort_order: index,
        }));
        const { error: insertError } = await supabase.from('deck_cards').insert(rows);
        if (insertError) throw insertError;
      }

      setIsDirty(false);
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err) {
      console.error('Deck save error:', err);
      setSaveMsg('Save failed');
    } finally {
      setSaving(false);
    }
  }, [deckId, deckName, cards]);

  const handleBack = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    router.push('/deck');
  };

  if (checking || !userId) return null;

  if (notFound) {
    return (
      <div className="ca-page">
        <Navbar />
        <div className="ca-container">
          <div className="ca-state-message">
            Deck not found.
            <div style={{ marginTop: 12 }}>
              <button onClick={() => router.push('/deck')} className="ca-btn ca-btn-ghost ca-btn-md">Back to decks</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const digiEggPct = Math.min(100, (digiEggCount / MAX_DIGI_EGG) * 100);
  const nonEggPct = Math.min(100, (nonEggCount / MAX_NON_EGG) * 100);

  const mainDeckCards = cards.filter(c => !isDigiEgg(c.card_type));
  const eggCards = cards.filter(c => isDigiEgg(c.card_type));

  return (
    <div className="ca-page">
      <Navbar />

      <div className="ca-container">
        <div className="ca-list-header-row">
          <div style={{ flex: 1 }}>
            <button onClick={handleBack} className="ca-btn ca-btn-ghost ca-btn-sm" style={{ marginBottom: 10 }}>← Back to decks</button>
            <input
              value={deckName}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Deck name"
              className="ca-input ca-deck-name-input"
              disabled={deckLoading}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(saving || saveMsg) && (
              <span className={`ca-save-indicator${saveMsg?.includes('failed') ? ' is-failed' : saving ? '' : ' is-saved'}`}>
                {saving && <span className="ca-spinner ca-spinner--sm" />}
                {saving ? 'Saving…' : saveMsg}
              </span>
            )}
            {!saving && !saveMsg && isDirty && (
              <span className="ca-save-indicator">Unsaved changes</span>
            )}
            <button onClick={handleSave} disabled={saving || !isDirty || deckLoading} className="ca-btn ca-btn-primary ca-btn-md">
              Save
            </button>
          </div>
        </div>

        <DeckSearchBar onAdd={handleAddCard} isAdded={isAdded} canAdd={canAddCard} />

        <div className="ca-deck-counts-row">
          <div className="ca-deck-count">
            <div className="ca-deck-count-label">
              <span>Digi-Eggs</span>
              <span>{digiEggCount} / {MAX_DIGI_EGG}</span>
            </div>
            <div className="ca-deck-progress-track">
              <div className="ca-deck-progress-fill is-egg" style={{ width: `${digiEggPct}%` }} />
            </div>
          </div>
          <div className="ca-deck-count">
            <div className="ca-deck-count-label">
              <span>Cards</span>
              <span>{nonEggCount} / {MAX_NON_EGG}</span>
            </div>
            <div className="ca-deck-progress-track">
              <div className="ca-deck-progress-fill" style={{ width: `${nonEggPct}%` }} />
            </div>
          </div>
        </div>

        {deckLoading ? (
          <div className="ca-state-message">Loading…</div>
        ) : cards.length === 0 ? (
          <div className="ca-empty-state">
            <div className="ca-empty-icon">🃏</div>
            <div className="ca-empty-title">No cards in this deck yet.</div>
            <div className="ca-empty-subtitle">Search above to start adding cards.</div>
          </div>
        ) : (
          <>
            <div className="ca-deck-section">
              <div className="ca-deck-section-header">
                <h2 className="ca-deck-section-title">Main Deck</h2>
                <div className="ca-deck-section-actions">
                  <button
                    onClick={handleSortMainDeck}
                    disabled={mainDeckCards.length < 2}
                    className="ca-btn ca-btn-ghost ca-btn-sm"
                  >
                    ⇅ Sort
                  </button>
                  <span className="ca-deck-section-count">{nonEggCount} / {MAX_NON_EGG}</span>
                </div>
              </div>
              {mainDeckCards.length === 0 ? (
                <div className="ca-empty-state ca-empty-state--sm">
                  <div className="ca-empty-subtitle">No Digimon, Tamer, or Option cards yet.</div>
                </div>
              ) : (
                <div className="ca-deck-grid">
                  {mainDeckCards.map(card => (
                    <DeckGridCard
                      key={card.id}
                      card={card}
                      canIncrement={!isFull(card.card_type) && !atCopyLimit(card.card_number)}
                      onIncrement={handleIncrement}
                      onDecrement={handleDecrement}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="ca-deck-section">
              <div className="ca-deck-section-header">
                <h2 className="ca-deck-section-title">Egg Deck</h2>
                <span className="ca-deck-section-count">{digiEggCount} / {MAX_DIGI_EGG}</span>
              </div>
              {eggCards.length === 0 ? (
                <div className="ca-empty-state ca-empty-state--sm">
                  <div className="ca-empty-subtitle">No Digi-Eggs yet.</div>
                </div>
              ) : (
                <div className="ca-deck-grid">
                  {eggCards.map(card => (
                    <DeckGridCard
                      key={card.id}
                      card={card}
                      canIncrement={!isFull(card.card_type) && !atCopyLimit(card.card_number)}
                      onIncrement={handleIncrement}
                      onDecrement={handleDecrement}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
