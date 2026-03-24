'use client';

import React, { useCallback, useEffect, useState } from 'react';
import SearchModal from './SearchModal';
import { supabase } from '@/lib/supabase';

type ListType = 'wishlist' | 'tradelist';

interface CardEntry {
  id: string;
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string;
  quantity: number | null;
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

  /* ── auth guard + onboarding check ── */
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        window.location.replace('/');
        return;
      }

      // Check if user has completed onboarding (has a display_name)
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

  /* ── logout ── */
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.replace('/');
  }, []);

  if (checking || !userId) return null;

  const cards = lists[activeTab];
  const isLoading = loading[activeTab];

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0e', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: '#e8e6e0' }}>

      {/* ── nav ── */}
      <nav style={{ borderBottom: '1px solid #1e1e24', background: '#0c0c0e', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: '#e8e6e0' }}>Cardboard Addiction</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {displayName && (
              <span style={{ fontSize: 13, color: '#888' }}>{displayName}</span>
            )}
            <button
              onClick={handleLogout}
              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #2a2a32', background: 'transparent', color: '#888', cursor: 'pointer' }}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

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
        </div>

        {/* ── card table ── */}
        <div style={{ background: '#111115', border: '1px solid #1e1e24', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 36px', gap: 8, padding: '10px 16px', borderBottom: '1px solid #1e1e24', background: '#0e0e12' }}>
            {['Card', 'Number', 'Qty', ''].map((h, i) => (
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
                style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 36px', gap: 8, alignItems: 'center', padding: '10px 16px', borderBottom: i < cards.length - 1 ? '1px solid #18181e' : 'none', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#141418')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {card.tcgplayer_name || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: '#444', fontFamily: 'monospace', marginTop: 1 }}>tcg:{card.tcgplayer_id}</div>
                </div>
                <div style={{ fontSize: 12, color: '#555', fontFamily: 'monospace' }}>{card.card_number || '—'}</div>
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
              disabled={saving || cards.length === 0}
              style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: saving || cards.length === 0 ? '#1e1e28' : '#4f46e5', color: saving || cards.length === 0 ? '#444' : '#fff', fontSize: 13, fontWeight: 600, cursor: cards.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
            >
              {saving ? 'Saving…' : 'Save list'}
            </button>
          </div>
        </div>
      </div>

      <SearchModal open={showModal} onClose={() => setShowModal(false)} onAdd={handleAdd} />
    </div>
  );
}