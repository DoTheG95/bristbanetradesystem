'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import SearchModal from '../components/SearchModal';
import MakeOfferModal from '../components/MakeOfferModal';
import MatchModal, { MatchResult, MatchedCard } from '../components/MatchModal';
import { supabase } from '@/lib/supabase';
import Navbar from '../components/Navbar';

type ListType = 'wishlist' | 'tradelist';
type SortField = 'date_added' | 'name' | 'rarity' | 'card_number';
type SortDir   = 'asc' | 'desc';

// Rarity order for sort (lower index = more common)
const RARITY_ORDER: Record<string, number> = { C: 0, U: 1, UC: 1, R: 2, SR: 3, UR: 4, SEC: 5, P: 6 };

interface CardEntry {
  id: string;
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string;
  quantity: number | null;
  rarity: string | null;
  created_at?: string;
  price: number | null;
}

interface PopoverState {
  cardId: string;
  src: string;
  name: string;
  x: number;
  y: number;
}

const EMPTY: Record<ListType, CardEntry[]> = { wishlist: [], tradelist: [] };
const PER_PAGE_OPTIONS = [5, 10, 20, 50, 100];
const AUTO_SAVE_DELAY  = 1500;

const SORT_LABELS: Record<SortField, string> = {
  date_added:  'Date added',
  name:        'Name',
  rarity:      'Rarity',
  card_number: 'Card no.',
};

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
  const autoSaveTimer                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyTabs                     = useRef<Set<ListType>>(new Set());

  // Search
  const [tableSearch, setTableSearch] = useState('');

  // Sort
  const [sortField, setSortField] = useState<SortField>('date_added');
  const [sortDir, setSortDir]     = useState<SortDir>('desc');

  // Pagination
  const [currentPage, setCurrentPage]   = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Match Me state — now uses MatchModal for scope selection, then results modal
  const [showMatchScopeModal, setShowMatchScopeModal] = useState(false);
  const [matchResults, setMatchResults]               = useState<MatchResult[] | null>(null);
  const [showMatchResults, setShowMatchResults]       = useState(false);

  // Make Offer state
  const [offerTarget, setOfferTarget] = useState<MatchResult | null>(null);

  /* ── auth guard ── */
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.replace('/'); return; }
      const { data: profile } = await supabase
        .from('profiles').select('display_name').eq('id', session.user.id).single();
      if (!profile?.display_name) { window.location.replace('/onboarding'); return; }
      setUserId(session.user.id);
      setUserEmail(session.user.email ?? null);
      setDisplayName(profile.display_name);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) window.location.replace('/');
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (checking || !userId) return;
    if (lists[activeTab].length > 0) return;
    const loadCards = async () => {
      setLoading(prev => ({ ...prev, [activeTab]: true }));
      const { data, error } = await supabase
        .from('user_cards').select('*').eq('user_id', userId).eq('list_type', activeTab);
      if (error) { console.error('Load error:', error); }
      else {
        setLists(prev => ({
          ...prev,
          [activeTab]: (data ?? []).map(c => ({
            id:             c.id,
            tcgplayer_id:   String(c.tcgplayer_id),
            tcgplayer_name: c.tcgplayer_name ?? '',
            card_number:    c.card_number ?? '',
            quantity:       c.quantity ?? null,
            rarity:         c.rarity ?? null,
            created_at:     c.created_at ?? '',
            price: c.price ?? null,
          })),
        }));
      }
      setLoading(prev => ({ ...prev, [activeTab]: false }));
    };
    loadCards();
  }, [activeTab, checking, userId]);

  // Reset page + selection when tab / search / sort changes
  useEffect(() => {
    setCurrentPage(1);
    setSelected(new Set());
  }, [activeTab, tableSearch, sortField, sortDir]);

  /* ── Auto-save ── */
  const triggerAutoSave = useCallback((tab: ListType, updatedLists: Record<ListType, CardEntry[]>) => {
    if (!userId) return;
    dirtyTabs.current.add(tab);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const tabsToSave = Array.from(dirtyTabs.current);
      dirtyTabs.current = new Set();
      setSaving(true); setSaveMsg(null);
      try {
        for (const t of tabsToSave) {
          const { error: deleteError } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('list_type', t);
          if (deleteError) throw deleteError;
          const rows = updatedLists[t].map(c => ({
            user_id: userId, list_type: t, tcgplayer_id: c.tcgplayer_id,
            tcgplayer_name: c.tcgplayer_name, card_number: c.card_number,
            quantity: c.quantity, rarity: c.rarity, price:c.price
          }));
          if (rows.length > 0) {
            const { error: insertError } = await supabase.from('user_cards').insert(rows);
            if (insertError) throw insertError;
          }
        }
        setSaveMsg('Saved');
        setTimeout(() => setSaveMsg(null), 2000);
      } catch (err: any) { console.error('Auto-save error:', err); setSaveMsg('Save failed'); }
      finally { setSaving(false); }
    }, AUTO_SAVE_DELAY);
  }, [userId]);

  /* ── Manual save (commented out from UI) ── */
  const handleSave = useCallback(async () => {
    if (!userId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    dirtyTabs.current = new Set();
    setSaving(true); setSaveMsg(null);
    try {
      const { error: deleteError } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('list_type', activeTab);
      if (deleteError) throw deleteError;
      const rows = lists[activeTab].map(c => ({
        user_id: userId, list_type: activeTab, tcgplayer_id: c.tcgplayer_id,
        tcgplayer_name: c.tcgplayer_name, card_number: c.card_number,
        quantity: c.quantity, rarity: c.rarity,
      }));
      if (rows.length > 0) {
        const { error: insertError } = await supabase.from('user_cards').insert(rows);
        if (insertError) throw insertError;
      }
      setSaveMsg(`Saved ${rows.length} card${rows.length !== 1 ? 's' : ''}`);
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (err: any) { console.error('Save error:', err); setSaveMsg('Save failed — please try again'); }
    finally { setSaving(false); }
  }, [activeTab, lists, userId]);

  /* ── Sort toggle ── */
  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  /* ── Match results handler (called by MatchModal) ── */
  const handleMatchResults = useCallback((results: MatchResult[]) => {
    setMatchResults(results);
    setShowMatchResults(true);
  }, []);

  /* ── popover handlers ── */
  const handleImageMouseEnter = useCallback((e: React.MouseEvent<HTMLImageElement>, card: CardEntry) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({ cardId: card.id, src: `https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_800x800.jpg`, name: card.card_number, x: rect.right + 12, y: rect.top + rect.height / 2 });
  }, []);
  const handleImageMouseLeave = useCallback(() => setPopover(null), []);

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
          id:             crypto.randomUUID(),
          tcgplayer_id,
          tcgplayer_name: item.tcgplayer_name ?? '',
          card_number:    item.card_number ?? item.raw?.id ?? '',
          quantity: item.quantity ?? null,
          rarity:         item.raw?.rarity ?? item.rarity ?? null,
          created_at:     new Date().toISOString(),
          price: item.price ?? null,
        });
      }
      const updated = { ...prev, [activeTab]: next };
      triggerAutoSave(activeTab, updated);
      return updated;
    });
    setShowModal(false);
  }, [activeTab, triggerAutoSave]);

  /* ── remove card ── */
  const removeCard = useCallback((tab: ListType, id: string) => {
    setLists(prev => {
      const updated = { ...prev, [tab]: prev[tab].filter(c => c.id !== id) };
      triggerAutoSave(tab, updated);
      return updated;
    });
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, [triggerAutoSave]);

  /* ── bulk remove ── */
  const bulkRemove = useCallback(() => {
    setLists(prev => {
      const updated = { ...prev, [activeTab]: prev[activeTab].filter(c => !selected.has(c.id)) };
      triggerAutoSave(activeTab, updated);
      return updated;
    });
    setSelected(new Set());
  }, [activeTab, selected, triggerAutoSave]);

  /* ── update quantity ── */
  const updateQty = useCallback((tab: ListType, id: string, raw: string) => {
    const n = parseInt(raw, 10);
    setLists(prev => {
      const updated = { ...prev, [tab]: prev[tab].map(c => c.id === id ? { ...c, quantity: isNaN(n) || n < 1 ? null : n } : c) };
      triggerAutoSave(tab, updated);
      return updated;
    });
  }, [triggerAutoSave]);

  const updatePrice = useCallback((tab: ListType, id: string, raw: string) => {
    const n = parseFloat(raw);
    setLists(prev => {
      const updated = { ...prev, [tab]: prev[tab].map(c =>
        c.id === id ? { ...c, price: isNaN(n) || n < 0 ? null : parseFloat(n.toFixed(2)) } : c
      )};
      triggerAutoSave(tab, updated);
      return updated;
    });
  }, [triggerAutoSave]);

  if (checking || !userId) return null;

  const cards     = lists[activeTab];
  const isLoading = loading[activeTab];

  // Filter
  const q = tableSearch.trim().toLowerCase();
  const filteredCards = q
    ? cards.filter(c => c.tcgplayer_name.toLowerCase().includes(q) || c.card_number.toLowerCase().includes(q))
    : cards;

  // Sort
  const sortedCards = [...filteredCards].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'date_added':
        cmp = (a.created_at ?? '') < (b.created_at ?? '') ? -1 : (a.created_at ?? '') > (b.created_at ?? '') ? 1 : 0;
        break;
      case 'name':
        cmp = a.tcgplayer_name.localeCompare(b.tcgplayer_name);
        break;
      case 'rarity':
        cmp = (RARITY_ORDER[a.rarity ?? ''] ?? -1) - (RARITY_ORDER[b.rarity ?? ''] ?? -1);
        break;
      case 'card_number':
        cmp = a.card_number.localeCompare(b.card_number, undefined, { numeric: true });
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedCards.length / itemsPerPage));
  const safePage   = Math.min(currentPage, totalPages);
  const pageStart  = (safePage - 1) * itemsPerPage;
  const pageCards  = sortedCards.slice(pageStart, pageStart + itemsPerPage);

  // Bulk select helpers
  const pageIds         = pageCards.map(c => c.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const somePagePartial = pageIds.some(id => selected.has(id)) && !allPageSelected;
  const someSelected    = selected.size > 0;

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelected(prev => { const n = new Set(prev); pageIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); pageIds.forEach(id => n.add(id)); return n; });
    }
  };
  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const pgBtn = (disabled: boolean): React.CSSProperties => ({
    width: 30, height: 30, borderRadius: 6, border: '1px solid #2a2a32',
    background: disabled ? 'transparent' : '#141418', color: disabled ? '#2a2a32' : '#888',
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  const SortBtn = ({ field }: { field: SortField }) => {
    const active = sortField === field;
    return (
      <button
        onClick={() => handleSortToggle(field)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5, border: `1px solid ${active ? '#4f46e5' : '#2a2a32'}`, background: active ? '#16182a' : 'transparent', color: active ? '#818cf8' : '#555', fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap' }}
      >
        {SORT_LABELS[field]}
        <span style={{ fontSize: 9 }}>{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </button>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0e', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: '#e8e6e0' }}>
      <Navbar />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* ── Header row ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', margin: 0, color: '#e8e6e0' }}>My Lists</h1>
            <p style={{ fontSize: 14, color: '#555', marginTop: 6, marginBottom: 0 }}>Track cards you want and cards you're trading away.</p>
          </div>
          <button
            onClick={() => setShowMatchScopeModal(true)}
            style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: 4 }}
            onMouseEnter={e => e.currentTarget.style.background = '#6056f5'}
            onMouseLeave={e => e.currentTarget.style.background = '#4f46e5'}
          >
            ⚡ Match me!
          </button>
        </div>

        {/* ── Tabs row + Add button ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 4, background: '#141418', borderRadius: 10, padding: 4 }}>
            {(['wishlist', 'tradelist'] as ListType[]).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setTableSearch(''); }}
                style={{ padding: '7px 20px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', background: activeTab === tab ? '#1e1e28' : 'transparent', color: activeTab === tab ? '#e8e6e0' : '#555', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.4)' : 'none' }}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(saving || saveMsg) && (
              <span style={{ fontSize: 11, color: saveMsg?.includes('failed') ? '#c0392b' : saving ? '#555' : '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                {saving && <span style={{ display: 'inline-block', width: 10, height: 10, border: '1.5px solid #333', borderTopColor: '#555', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
                {saving ? 'Saving…' : saveMsg}
              </span>
            )}
            <button
              onClick={() => setShowModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #2a2a32', background: '#141418', color: '#d4d2cc', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#3a3a48'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a32'; }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add cards
            </button>
            {/* Save button — commented out, auto-save handles this
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Save list'}
            </button>
            */}
          </div>
        </div>

        {/* ── Search bar ── */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#444', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text" value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
            placeholder={`Search ${activeTab === 'wishlist' ? 'wishlist' : 'trade list'}…`}
            style={{ width: '100%', padding: '8px 36px 8px 36px', background: '#111115', border: '1px solid #1e1e24', borderRadius: 8, color: '#e8e6e0', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
            onFocus={e => e.currentTarget.style.borderColor = '#2a2a3a'}
            onBlur={e => e.currentTarget.style.borderColor = '#1e1e24'}
          />
          {tableSearch && (
            <button onClick={() => setTableSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
          )}
        </div>

        {/* ── Sort controls ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 10, color: '#333', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginRight: 2 }}>Sort</span>
          {(['date_added', 'name', 'rarity', 'card_number'] as SortField[]).map(f => <SortBtn key={f} field={f} />)}
        </div>

        {/* ── Bulk action bar ── */}
        {someSelected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: '#16162a', border: '1px solid #2a2a3a', borderRadius: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 600 }}>{selected.size} selected</span>
            <div style={{ flex: 1 }} />
            <button onClick={bulkRemove} style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #c0392b', background: 'transparent', color: '#c0392b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = '#c0392b22'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>Remove selected</button>
            <button onClick={() => setSelected(new Set())} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #2a2a32', background: 'transparent', color: '#555', fontSize: 12, cursor: 'pointer' }}>Clear</button>
          </div>
        )}

        {/* ── Card table ── */}
        <div style={{ background: '#111115', border: '1px solid #1e1e24', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '36px 150px 1fr 60px 90px 90px 36px', gap: 8, padding: '10px 16px', borderBottom: '1px solid #1e1e24', background: '#0e0e12', alignItems: 'center' }}>
            <div onClick={toggleSelectAll} style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${allPageSelected ? '#4f46e5' : '#2a2a32'}`, background: allPageSelected ? '#4f46e5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              {allPageSelected && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
              {somePagePartial && <span style={{ color: '#4f46e5', fontSize: 11, lineHeight: 1 }}>–</span>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em' }}></span>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Card</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Rarity</span>
            {/* Qty header with per-page dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Qty</span>
              <select
                value={itemsPerPage}
                onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                title="Items per page"
                style={{ background: '#1a1a22', border: '1px solid #2a2a32', borderRadius: 4, color: '#555', fontSize: 9, padding: '1px 3px', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
              >
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <span />
          </div>

          {isLoading ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#333', fontSize: 13 }}>Loading…</div>
          ) : cards.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: '#333', fontSize: 14 }}>
              {activeTab === 'wishlist' ? 'No cards on your wishlist yet.' : 'No cards on your trade list yet.'}<br />
              <span style={{ fontSize: 12, color: '#2a2a32' }}>Use the + button above to add cards.</span>
            </div>
          ) : sortedCards.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#333', fontSize: 13 }}>
              No cards match "<span style={{ color: '#555' }}>{tableSearch}</span>"
            </div>
          ) : (
            pageCards.map((card, i) => {
              const isSelected = selected.has(card.id);
              return (
                <div
                  key={card.id}
                  style={{ display: 'grid', gridTemplateColumns: '36px 150px 1fr 60px 90px 90px 36px', gap: 8, alignItems: 'center', padding: '10px 16px', borderBottom: i < pageCards.length - 1 ? '1px solid #18181e' : 'none', transition: 'background 0.1s', background: isSelected ? '#16162a' : 'transparent' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#141418'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#16162a' : 'transparent'; }}
                >
                  <div onClick={() => toggleSelect(card.id)} style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${isSelected ? '#4f46e5' : '#2a2a32'}`, background: isSelected ? '#4f46e5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    {isSelected && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
                  </div>
                  <img
                    src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
                    onMouseEnter={e => handleImageMouseEnter(e, card)}
                    onMouseLeave={handleImageMouseLeave}
                    alt={card.tcgplayer_name}
                    style={{ width: 100, height: 100, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }}
                  />
                  <div style={{ fontSize: 12, color: '#555', fontFamily: 'monospace' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.tcgplayer_name || '—'}</div>
                    {card.card_number || '—'}
                  </div>
                  {/* Rarity badge */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textAlign: 'center' }}>
                    {card.rarity ?? '—'}
                  </div>
                  <input
                    type="number" min={1}
                    value={card.quantity ?? ''}
                    onChange={e => updateQty(activeTab, card.id, e.target.value)}
                    placeholder="—"
                    style={{ width: '100%', padding: '4px 8px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 6, color: '#d4d2cc', fontSize: 13, textAlign: 'center', outline: 'none' }}
                  />

            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#4ade80', pointerEvents: 'none' }}>$</span>
              <input
                type="number" min={0} step={0.01}
                value={card.price ?? ''}
                onChange={e => updatePrice(activeTab, card.id, e.target.value)}
                placeholder="—"
                style={{ width: '100%', padding: '4px 6px 4px 18px', background: card.price != null ? '#0e1a0e' : '#18181e', border: `1px solid ${card.price != null ? '#1a3a1a' : '#2a2a32'}`, borderRadius: 6, color: '#4ade80', fontSize: 13, outline: 'none' }}
              />
            </div>
                  <button
                    onClick={() => removeCard(activeTab, card.id)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #2a2a32', background: 'transparent', color: '#444', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#c0392b'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#c0392b'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#444'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a32'; }}
                  >×</button>
                </div>
              );
            })
          )}
        </div>

        {/* ── Pagination ── */}
        {sortedCards.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: '#444' }}>
              {sortedCards.length} card{sortedCards.length !== 1 ? 's' : ''}
              {q ? ` (filtered from ${cards.length})` : ''}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => setCurrentPage(1)} disabled={safePage === 1} style={pgBtn(safePage === 1)}>{'|<'}</button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={pgBtn(safePage === 1)}>{'<'}</button>
              <span style={{ fontSize: 12, color: '#555', minWidth: 70, textAlign: 'center' }}>{safePage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={pgBtn(safePage === totalPages)}>{'>'}</button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages} style={pgBtn(safePage === totalPages)}>{'>|'}</button>
            </div>
            <span style={{ fontSize: 12, color: '#444' }}>
              {pageStart + 1}–{Math.min(pageStart + itemsPerPage, sortedCards.length)} of {sortedCards.length}
            </span>
          </div>
        )}
      </div>

      {/* ── Card image popover ── */}
      {popover && (
        <div ref={popoverRef} style={{ position: 'fixed', left: popover.x, top: popover.y, transform: 'translateY(-50%)', zIndex: 9999, background: '#1a1a22', border: '1px solid #2a2a38', borderRadius: 10, padding: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.7)', pointerEvents: 'none', animation: 'popoverIn 0.12s ease' }}>
          <img src={popover.src} alt={popover.name} style={{ width: 500, height: 500, objectFit: 'contain', borderRadius: 6, display: 'block' }} />
        </div>
      )}

      {/* ── Match scope modal ── */}
      {userId && (
        <MatchModal
          open={showMatchScopeModal}
          onClose={() => setShowMatchScopeModal(false)}
          userId={userId}
          onResults={handleMatchResults}
        />
      )}

      {/* ── Match results modal ── */}
      {showMatchResults && matchResults !== null && (
        <div onClick={() => setShowMatchResults(false)} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', background: '#111115', border: '1px solid #1e1e24', borderRadius: 14, display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', animation: 'matchModalIn 0.18s ease' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #1e1e24', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e8e6e0' }}>Trade Matches</h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#555' }}>
                  {matchResults.length === 0 ? 'No matches found' : `${matchResults.length} trader${matchResults.length !== 1 ? 's' : ''} matched`}
                </p>
              </div>
              <button onClick={() => setShowMatchResults(false)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #2a2a32', background: 'transparent', color: '#555', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {matchResults.length === 0 ? (
                <div style={{ padding: '56px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🃏</div>
                  <div style={{ color: '#444', fontSize: 14 }}>No traders found.</div>
                  <div style={{ color: '#2a2a32', fontSize: 12, marginTop: 4 }}>Try broadening your scope or adding more cards.</div>
                </div>
              ) : matchResults.map((result, i) => {
                const isMutual = result.theyHaveForMe.length > 0 && result.iHaveForThem.length > 0;
                return (
                  <div key={result.userId} style={{ padding: '16px 20px', borderBottom: i < matchResults.length - 1 ? '1px solid #18181e' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: `hsl(${result.userId.charCodeAt(0) * 7 % 360}, 40%, 18%)`, border: `2px solid hsl(${result.userId.charCodeAt(0) * 7 % 360}, 55%, 32%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: `hsl(${result.userId.charCodeAt(0) * 7 % 360}, 75%, 65%)` }}>
                        {result.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e6e0' }}>{result.displayName}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          {result.digimon && <span style={{ fontSize: 10, color: '#4f46e5' }}>{result.digimon}</span>}
                          {result.distanceKm !== undefined && <span style={{ fontSize: 10, color: '#555' }}>📍 {result.distanceKm}km away</span>}
                          {isMutual && <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>✦ Mutual</span>}
                          {!isMutual && result.theyHaveForMe.length > 0 && <span style={{ fontSize: 10, color: '#4f46e5', fontWeight: 600 }}>They have cards you want</span>}
                          {!isMutual && result.iHaveForThem.length > 0 && result.theyHaveForMe.length === 0 && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>You have cards they want</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#4f46e5', lineHeight: 1 }}>{result.theyHaveForMe.length}</div>
                          <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>for you</div>
                        </div>
                        <button onClick={() => { setShowMatchResults(false); setOfferTarget(result); }} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }} onMouseEnter={e => (e.currentTarget.style.background = '#6056f5')} onMouseLeave={e => (e.currentTarget.style.background = '#4f46e5')}>
                          Make Offer
                        </button>
                      </div>
                    </div>

                    {result.theyHaveForMe.length > 0 && (
                      <div style={{ marginBottom: result.iHaveForThem.length > 0 ? 12 : 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>In their trade list ↓</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {result.theyHaveForMe.map(card => (
                            <div key={card.tcgplayer_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#16161c', borderRadius: 7 }}>
                              <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`} alt={card.tcgplayer_name} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.tcgplayer_name || '—'}</div>
                                <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>{card.card_number}</div>
                              </div>
                              {card.rarity && <span style={{ fontSize: 9, color: '#555', fontWeight: 700, flexShrink: 0 }}>{card.rarity}</span>}
                              {card.qty != null && <span style={{ fontSize: 10, color: '#555', flexShrink: 0 }}>×{card.qty}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.iHaveForThem.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>They're looking for ({result.iHaveForThem.length}) ↓</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {result.iHaveForThem.map(card => (
                            <div key={card.tcgplayer_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#16161c', border: '1px solid #2a2218', borderRadius: 7 }}>
                              <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`} alt={card.tcgplayer_name} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.tcgplayer_name || '—'}</div>
                                <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>{card.card_number}</div>
                              </div>
                              {card.rarity && <span style={{ fontSize: 9, color: '#555', fontWeight: 700, flexShrink: 0 }}>{card.rarity}</span>}
                              {card.qty != null && <span style={{ fontSize: 10, color: '#555', flexShrink: 0 }}>×{card.qty}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
        @keyframes popoverIn { from { opacity: 0; transform: translateY(-50%) scale(0.92); } to { opacity: 1; transform: translateY(-50%) scale(1); } }
        @keyframes matchModalIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <SearchModal open={showModal} onClose={() => setShowModal(false)} onAdd={handleAdd} />
    </div>
  );
}