'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import SearchModal from '../components/SearchModal';
import MakeOfferModal from '../components/MakeOfferModal';
import { supabase } from '@/lib/supabase';
import Navbar from '../components/Navbar';

type ListType = 'wishlist' | 'tradelist';

interface CardEntry {
  id: string;
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string;
  quantity: number | null;
}

interface PopoverState {
  cardId: string;
  src: string;
  name: string;
  x: number;
  y: number;
}

interface MatchedCard {
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string | null;
  quantity: number | null;
}

interface MatchResult {
  userId: string;
  displayName: string;
  theyHaveForMe: MatchedCard[];
  iHaveForThem: MatchedCard[];
}

const EMPTY: Record<ListType, CardEntry[]> = { wishlist: [], tradelist: [] };

export default function MainPage() {
  const [userId, setUserId]           = useState<string | null>(null);
  const [userEmail, setUserEmail]     = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [checking, setChecking]       = useState(true);
  const [activeTab, setActiveTab]     = useState<ListType>('wishlist');
  const [lists, setLists]             = useState<Record<ListType, CardEntry[]>>(EMPTY);
  const [showModal, setShowModal]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState<string | null>(null);
  const [loading, setLoading]         = useState<Record<ListType, boolean>>({ wishlist: false, tradelist: false });
  const [popover, setPopover]         = useState<PopoverState | null>(null);
  const popoverRef                    = useRef<HTMLDivElement>(null);

  // Match Me state
  const [matchLoading, setMatchLoading]     = useState(false);
  const [matchResults, setMatchResults]     = useState<MatchResult[] | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);

  // Make Offer state
  const [offerTarget, setOfferTarget] = useState<MatchResult | null>(null);

  /* ── auth guard + onboarding check ── */
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
      setUserEmail(session.user.email ?? null);
      setDisplayName(profile.display_name);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        window.location.replace('/');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (checking || !userId) return;
    if (lists[activeTab].length > 0) return;

    const loadCards = async () => {
      setLoading(prev => ({ ...prev, [activeTab]: true }));

      const { data, error } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', userId)
        .eq('list_type', activeTab);

      if (error) {
        console.error('Load error:', error);
      } else {
        setLists(prev => ({
          ...prev,
          [activeTab]: (data ?? []).map(c => ({
            id: c.id,
            tcgplayer_id: String(c.tcgplayer_id),
            tcgplayer_name: c.tcgplayer_name ?? '',
            card_number: c.card_number ?? '',
            quantity: c.quantity ?? null,
          })),
        }));
      }

      setLoading(prev => ({ ...prev, [activeTab]: false }));
    };

    loadCards();
  }, [activeTab, checking, userId]);

  /* ── Match Me ── */
  const handleMatch = useCallback(async () => {
    if (!userId) return;
    setMatchLoading(true);
    setMatchResults(null);
    setShowMatchModal(true);

    try {
      let myWishlist  = lists['wishlist'];
      let myTradelist = lists['tradelist'];

      if (myWishlist.length === 0) {
        const { data } = await supabase
          .from('user_cards').select('*')
          .eq('user_id', userId).eq('list_type', 'wishlist');
        myWishlist = (data ?? []).map(c => ({
          id: c.id, tcgplayer_id: String(c.tcgplayer_id),
          tcgplayer_name: c.tcgplayer_name ?? '', card_number: c.card_number ?? '', quantity: c.quantity ?? null,
        }));
        setLists(prev => ({ ...prev, wishlist: myWishlist }));
      }

      if (myTradelist.length === 0) {
        const { data } = await supabase
          .from('user_cards').select('*')
          .eq('user_id', userId).eq('list_type', 'tradelist');
        myTradelist = (data ?? []).map(c => ({
          id: c.id, tcgplayer_id: String(c.tcgplayer_id),
          tcgplayer_name: c.tcgplayer_name ?? '', card_number: c.card_number ?? '', quantity: c.quantity ?? null,
        }));
        setLists(prev => ({ ...prev, tradelist: myTradelist }));
      }

      if (myWishlist.length === 0) {
        setMatchResults([]);
        setMatchLoading(false);
        return;
      }

      const myWishlistIds  = myWishlist.map(c => c.tcgplayer_id);
      const myTradelistIds = myTradelist.map(c => c.tcgplayer_id);

      const { data: tradeMatches } = await supabase
        .from('user_cards')
        .select('user_id, tcgplayer_id, tcgplayer_name, card_number, quantity')
        .eq('list_type', 'tradelist')
        .in('tcgplayer_id', myWishlistIds)
        .neq('user_id', userId);

      const { data: wishMatches } = myTradelistIds.length > 0
        ? await supabase
            .from('user_cards')
            .select('user_id, tcgplayer_id, tcgplayer_name, card_number, quantity')
            .eq('list_type', 'wishlist')
            .in('tcgplayer_id', myTradelistIds)
            .neq('user_id', userId)
        : { data: [] };

      const primaryUserIds = Array.from(new Set((tradeMatches ?? []).map(r => r.user_id)));

      if (primaryUserIds.length === 0) {
        setMatchResults([]);
        setMatchLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles').select('id, display_name').in('id', primaryUserIds);

      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.display_name ?? 'Unknown']));

      const resultsMap: Record<string, MatchResult> = {};
      for (const uid of primaryUserIds) {
        resultsMap[uid] = { userId: uid, displayName: profileMap[uid] ?? 'Unknown', theyHaveForMe: [], iHaveForThem: [] };
      }
      for (const row of (tradeMatches ?? [])) {
        resultsMap[row.user_id]?.theyHaveForMe.push({
          tcgplayer_id: String(row.tcgplayer_id), tcgplayer_name: row.tcgplayer_name ?? '',
          card_number: row.card_number ?? '', quantity: row.quantity ?? null,
        });
      }
      for (const row of (wishMatches ?? [])) {
        if (resultsMap[row.user_id]) {
          resultsMap[row.user_id].iHaveForThem.push({
            tcgplayer_id: String(row.tcgplayer_id), tcgplayer_name: row.tcgplayer_name ?? '',
            card_number: row.card_number ?? '', quantity: row.quantity ?? null,
          });
        }
      }

      const sorted = Object.values(resultsMap).sort((a, b) => {
        const diff = b.theyHaveForMe.length - a.theyHaveForMe.length;
        if (diff !== 0) return diff;
        return (b.iHaveForThem.length > 0 ? 1 : 0) - (a.iHaveForThem.length > 0 ? 1 : 0);
      });

      setMatchResults(sorted);
    } catch (err) {
      console.error('Match error:', err);
      setMatchResults([]);
    } finally {
      setMatchLoading(false);
    }
  }, [userId, lists]);

  /* ── popover handlers ── */
  const handleImageMouseEnter = useCallback((e: React.MouseEvent<HTMLImageElement>, card: CardEntry) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({
      cardId: card.id,
      src: `https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_800x800.jpg`,
      name: card.card_number,
      x: rect.right + 12,
      y: rect.top + rect.height / 2,
    });
  }, []);

  const handleImageMouseLeave = useCallback(() => {
    setPopover(null);
  }, []);

  /* ── add cards from modal ── */
  const handleAdd = useCallback((val: any) => {
    const incoming: any[] = Array.isArray(val) ? val : [val];
    setLists(prev => {
      const existing = prev[activeTab];
      const next = [...existing];
      for (const item of incoming) {
        const tcgplayer_id = String(item.raw?.tcgplayer_id ?? item.tcgplayer_id ?? '');
        if (!tcgplayer_id || tcgplayer_id === 'undefined') continue;
        if (next.some(c => c.tcgplayer_id === tcgplayer_id)) continue;
        next.push({
          id: crypto.randomUUID(),
          tcgplayer_id,
          tcgplayer_name: item.tcgplayer_name ?? '',
          card_number: item.card_number ?? item.raw?.id ?? '',
          quantity: null,
        });
      }
      return { ...prev, [activeTab]: next };
    });
    setShowModal(false);
  }, [activeTab]);

  /* ── remove card ── */
  const removeCard = useCallback((tab: ListType, id: string) => {
    setLists(prev => ({ ...prev, [tab]: prev[tab].filter(c => c.id !== id) }));
  }, []);

  /* ── update quantity ── */
  const updateQty = useCallback((tab: ListType, id: string, raw: string) => {
    const n = parseInt(raw, 10);
    setLists(prev => ({
      ...prev,
      [tab]: prev[tab].map(c => c.id === id ? { ...c, quantity: isNaN(n) || n < 1 ? null : n } : c),
    }));
  }, []);

  /* ── save list to DB ── */
  const handleSave = useCallback(async () => {
    if (!userId) return;
    setSaving(true);
    setSaveMsg(null);

    try {
      const { error: deleteError } = await supabase
        .from('user_cards')
        .delete()
        .eq('user_id', userId)
        .eq('list_type', activeTab);

      if (deleteError) throw deleteError;

      const rows = lists[activeTab].map(c => ({
        user_id:        userId,
        list_type:      activeTab,
        tcgplayer_id:   c.tcgplayer_id,
        tcgplayer_name: c.tcgplayer_name,
        card_number:    c.card_number,
        quantity:       c.quantity,
      }));

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('user_cards')
          .insert(rows);
        if (insertError) throw insertError;
      }

      setSaveMsg(`Saved ${rows.length} card${rows.length !== 1 ? 's' : ''}`);
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (err: any) {
      console.error('Save error:', err);
      setSaveMsg('Save failed — please try again');
    } finally {
      setSaving(false);
    }
  }, [activeTab, lists, userId]);

  if (checking || !userId) return null;

  const cards = lists[activeTab];
  const isLoading = loading[activeTab];

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0e', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: '#e8e6e0' }}>

      <Navbar />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', margin: 0, color: '#e8e6e0' }}>My Lists</h1>
          <p style={{ fontSize: 14, color: '#555', marginTop: 6 }}>Track cards you want and cards you're trading away.</p>
        </div>

        {/* ── tab bar ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#141418', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {(['wishlist', 'tradelist'] as ListType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '7px 20px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                background: activeTab === tab ? '#1e1e28' : 'transparent',
                color: activeTab === tab ? '#e8e6e0' : '#555',
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
              }}
            >
              {tab === 'wishlist' ? '✦ Wishlist' : '⇄ Trade list'}
              {lists[tab].length > 0 && (
                <span style={{ marginLeft: 7, fontSize: 11, background: activeTab === tab ? '#2e2e3e' : '#1e1e24', color: '#888', padding: '1px 7px', borderRadius: 99 }}>
                  {lists[tab].length}
                </span>
              )}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleMatch}
              disabled={matchLoading}
              style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: matchLoading || cards.length === 0 ? '#1e1e28' : '#4f46e5', color: matchLoading || cards.length === 0 ? '#444' : '#fff', fontSize: 13, fontWeight: 600, cursor: cards.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
            >
              {matchLoading ? 'Matching...' : 'Match me!'}
            </button>
          </div>
        </div>
     
        {/* ── card table ── */}
        <div style={{ background: '#111115', border: '1px solid #1e1e24', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 90px 36px', gap: 8, padding: '10px 16px', borderBottom: '1px solid #1e1e24', background: '#0e0e12' }}>
            {['', 'Card', 'Qty', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 600, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
            ))}
          </div>

          {isLoading ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#333', fontSize: 13 }}>Loading…</div>
          ) : cards.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: '#333', fontSize: 14 }}>
              {activeTab === 'wishlist' ? 'No cards on your wishlist yet.' : 'No cards on your trade list yet.'}<br />
              <span style={{ fontSize: 12, color: '#2a2a32' }}>Use the + button below to add cards.</span>
            </div>
          ) : (
            cards.map((card, i) => (
              <div
                key={card.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 220px 90px 36px', gap: 8, alignItems: 'center', padding: '10px 16px', borderBottom: i < cards.length - 1 ? '1px solid #18181e' : 'none', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#141418')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <img
                  src={"https://tcgplayer-cdn.tcgplayer.com/product/" + card.tcgplayer_id + "_in_200x200.jpg"}
                  onMouseEnter={e => handleImageMouseEnter(e, card)}
                  onMouseLeave={handleImageMouseLeave}
                  alt={card.tcgplayer_name}
                />
                <div style={{ fontSize: 12, color: '#555', fontFamily: 'monospace' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {card.tcgplayer_name || '—'}
                  </div>
                  {card.card_number || '—'}
                </div>
                <input
                  type="number" min={1}
                  value={card.quantity ?? ''}
                  onChange={e => updateQty(activeTab, card.id, e.target.value)}
                  placeholder="—"
                  style={{ width: '100%', padding: '4px 8px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 6, color: '#d4d2cc', fontSize: 13, textAlign: 'center', outline: 'none' }}
                />
                <button
                  onClick={() => removeCard(activeTab, card.id)}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #2a2a32', background: 'transparent', color: '#444', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#c0392b'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#c0392b'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#444'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a32'; }}
                >×</button>
              </div>
            ))
          )}
        </div>

        {/* ── action bar ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: '1px solid #2a2a32', background: '#141418', color: '#d4d2cc', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#3a3a48'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a32'; }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add cards
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {saveMsg && (
              <span style={{ fontSize: 12, color: saveMsg.includes('failed') ? '#c0392b' : '#4ade80' }}>
                {saveMsg}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
            >
              {saving ? 'Saving…' : 'Save list'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Card image popover ── */}
      {popover && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            left: popover.x,
            top: popover.y,
            transform: 'translateY(-50%)',
            zIndex: 9999,
            background: '#1a1a22',
            border: '1px solid #2a2a38',
            borderRadius: 10,
            padding: 10,
            boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
            pointerEvents: 'none',
            animation: 'popoverIn 0.12s ease',
          }}
        >
          <img
            src={popover.src}
            alt={popover.name}
            style={{ width: 500, height: 500, objectFit: 'contain', borderRadius: 6, display: 'block' }}          
          />
          {popover.name && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#888', textAlign: 'center', maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {popover.name}
            </div>
          )}
        </div>
      )}

      {/* ── Match results modal ── */}
      {showMatchModal && (
        <div
          onClick={() => setShowMatchModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560, maxHeight: '85vh',
              background: '#111115', border: '1px solid #1e1e24', borderRadius: 14,
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
              animation: 'matchModalIn 0.18s ease',
            }}
          >
            {/* Modal header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #1e1e24', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e8e6e0' }}>Trade Matches</h2>
                {!matchLoading && matchResults !== null && (
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#555' }}>
                    {matchResults.length === 0
                      ? 'No matches found for your wishlist'
                      : `${matchResults.length} trader${matchResults.length !== 1 ? 's' : ''} have cards you want`}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowMatchModal(false)}
                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #2a2a32', background: 'transparent', color: '#555', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>

            {/* Modal body */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {matchLoading ? (
                <div style={{ padding: '56px 20px', textAlign: 'center', color: '#444', fontSize: 13 }}>
                  <div style={{ marginBottom: 14 }}>
                    <span style={{ display: 'inline-block', width: 22, height: 22, border: '2px solid #2a2a32', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  </div>
                  Scanning traders…
                </div>
              ) : matchResults === null ? null : matchResults.length === 0 ? (
                <div style={{ padding: '56px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🃏</div>
                  <div style={{ color: '#444', fontSize: 14 }}>No traders found for your wishlist.</div>
                  <div style={{ color: '#2a2a32', fontSize: 12, marginTop: 4 }}>Try adding more cards to your wishlist.</div>
                </div>
              ) : (
                matchResults.map((result, i) => {
                  const isMutual = result.iHaveForThem.length > 0;
                  return (
                    <div
                      key={result.userId}
                      style={{ padding: '16px 20px', borderBottom: i < matchResults.length - 1 ? '1px solid #18181e' : 'none' }}
                    >
                      {/* Trader header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: `hsl(${result.userId.charCodeAt(0) * 7 % 360}, 40%, 18%)`,
                          border: `2px solid hsl(${result.userId.charCodeAt(0) * 7 % 360}, 55%, 32%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700,
                          color: `hsl(${result.userId.charCodeAt(0) * 7 % 360}, 75%, 65%)`,
                        }}>
                          {result.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e6e0' }}>{result.displayName}</div>
                          {isMutual && (
                            <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600, marginTop: 1 }}>
                              ✦ Mutual — they want cards you have too
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#4f46e5', lineHeight: 1 }}>{result.theyHaveForMe.length}</div>
                            <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>card{result.theyHaveForMe.length !== 1 ? 's' : ''} for you</div>
                          </div>
                          {/* Make Offer button */}
                          <button
                            onClick={() => {
                              setShowMatchModal(false);
                              setOfferTarget(result);
                            }}
                            style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#6056f5')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#4f46e5')}
                          >
                            Make Offer
                          </button>
                        </div>
                      </div>

                      {/* Cards they have from my wishlist */}
                      <div style={{ marginBottom: isMutual ? 12 : 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                          In their trade list ↓
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {result.theyHaveForMe.map(card => (
                            <div key={card.tcgplayer_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#16161c', borderRadius: 7 }}>
                              <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`} alt={card.tcgplayer_name} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.tcgplayer_name || '—'}</div>
                                <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>{card.card_number}</div>
                              </div>
                              {card.quantity != null && <span style={{ fontSize: 10, color: '#555', flexShrink: 0 }}>×{card.quantity}</span>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bonus: cards they want from my tradelist */}
                      {isMutual && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                            They're looking for ({result.iHaveForThem.length}) ↓
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {result.iHaveForThem.map(card => (
                              <div key={card.tcgplayer_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#16161c', border: '1px solid #2a2218', borderRadius: 7 }}>
                                <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`} alt={card.tcgplayer_name} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 500, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.tcgplayer_name || '—'}</div>
                                  <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>{card.card_number}</div>
                                </div>
                                {card.quantity != null && <span style={{ fontSize: 10, color: '#555', flexShrink: 0 }}>×{card.quantity}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Make Offer Modal ── */}
      {offerTarget && (
        <MakeOfferModal
          open={!!offerTarget}
          onClose={() => setOfferTarget(null)}
          receiverId={offerTarget.userId}
          receiverName={offerTarget.displayName}
          theyHaveForMe={offerTarget.theyHaveForMe}
        />
      )}

      <style>{`
        @keyframes popoverIn {
          from { opacity: 0; transform: translateY(-50%) scale(0.92); }
          to   { opacity: 1; transform: translateY(-50%) scale(1); }
        }
        @keyframes matchModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <SearchModal open={showModal} onClose={() => setShowModal(false)} onAdd={handleAdd} />
    </div>
  );
}