'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (item: any) => void;
};

type Mode = 'search' | 'bulk';

const RARITIES = ['C', 'U', 'R', 'SR', 'UR', 'SEC', 'P'] as const;
type Rarity = typeof RARITIES[number];

const SPECIAL_VARIANTS = ['Limited Foil', 'Alternate Art', 'SP', 'Rare Pull', 'Judge Pack', 'Box Topper'] as const;
type SpecialVariant = typeof SPECIAL_VARIANTS[number];

interface SelectedItem {
  id: string;
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string;
  rarity: string;
  combinedName: string;
  quantity: number | null; // null = "any / untracked"
  raw: any;
}

function extractParenText(name: string): string | null {
  const m = name.match(/\(([^)]+)\)/);
  return m ? m[1] : null;
}

function isSpecialVariant(name: string): boolean {
  const paren = extractParenText(name);
  if (!paren) return false;
  const lower = paren.toLowerCase();
  return lower.includes('limited foil') || lower.includes('alternate art') || lower.includes(' sp') || lower === 'sp' || lower.includes('rare pull');
}

function matchesSpecialFilter(name: string, filters: Set<SpecialVariant>): boolean {
  const paren = extractParenText(name);
  if (!paren) return false;
  const lower = paren.toLowerCase();
  if (filters.has('Limited Foil') && lower.includes('limited foil')) return true;
  if (filters.has('Alternate Art') && lower.includes('alternate art')) return true;
  if (filters.has('SP') && (lower.includes(' sp') || lower === 'sp')) return true;
  if (filters.has('Rare Pull') && lower.includes('rare pull')) return true;
  return false;
}

const RARITY_COLOURS: Record<string, string> = {
  C: '#555', U: '#4a7a6a', R: '#4f6fa8', SR: '#7c5abf', UR: '#b8860b', SEC: '#c0392b', P: '#888',
};

export default function SearchModal({ open, onClose, onAdd }: Props) {
  const [mode, setMode]                     = useState<Mode>('search');
  const [modalText, setModalText]           = useState('');
  const [results, setResults]               = useState<any[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedItems, setSelectedItems]   = useState<SelectedItem[]>([]);
  const inputRef                            = useRef<HTMLInputElement>(null);

  // Bulk mode
  const [packQuery, setPackQuery]           = useState('');
  const [packResults, setPackResults]       = useState<any[]>([]);
  const [loadingPack, setLoadingPack]       = useState(false);
  const [packError, setPackError]           = useState<string | null>(null);
  const [rarityFilters, setRarityFilters]   = useState<Set<Rarity>>(new Set());
  const [specialFilters, setSpecialFilters] = useState<Set<SpecialVariant>>(new Set());
  const [bulkSelected, setBulkSelected]     = useState<Set<string>>(new Set());
  const packInputRef                        = useRef<HTMLInputElement>(null);

  const [bulkQtyInput, setBulkQtyInput] = useState<string>('');

  // Reset on close
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setModalText(''); setResults([]); setSelectedItems([]);
      setMode('search');
      setPackQuery(''); setPackResults([]); setLoadingPack(false); setPackError(null);
      setRarityFilters(new Set()); setSpecialFilters(new Set()); setBulkSelected(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (mode === 'bulk') setTimeout(() => packInputRef.current?.focus(), 50);
    if (mode === 'search') setTimeout(() => inputRef.current?.focus(), 50);
  }, [mode]);

  // Card search
  useEffect(() => {
    if (!open || mode !== 'search') return;
    const q = modalText.trim();
    if (!q) { setResults([]); setLoadingResults(false); return; }

    const controller = new AbortController();
    const handle = setTimeout(() => {
      setLoadingResults(true);
      const parts = q.split(/\s+/).filter(Boolean);
      let cardToken: string | undefined = parts.find(p => p.includes('-'));
      if (!cardToken) {
        const maybe = parts.find(p => /^[a-z0-9]+\-?[a-z0-9]+$/i.test(p) && /\d/.test(p));
        if (maybe && maybe.includes('-')) cardToken = maybe;
      }
      const nameParts = parts.filter(p => p !== cardToken);
      const nameQuery = nameParts.join(' ').trim();
      const params: Record<string, string> = {};
      if (cardToken) params.card = cardToken;
      if (nameQuery) params.n = nameQuery;
      if (!cardToken && !nameQuery) params.n = q;

      const url = new URL('https://digimoncard.io/api-public/search');
      Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

      fetch(url.toString(), { signal: controller.signal })
        .then(r => r.json())
        .then(data => {
          if (!Array.isArray(data)) { setResults([]); return; }
          setResults(data.map((c: any) => {
            const cardNumber = c.id ?? c.card_number ?? c.cardNumber ?? '';
            const tcgName = c.tcgplayer_name ?? '';
            return {
              id: c.tcgplayer_id ? String(c.tcgplayer_id) : String(c.id ?? ''),
              tcgplayer_name: tcgName,
              tcgplayer_id: c.tcgplayer_id,
              card_name: c.name,
              card_number: cardNumber,
              rarity: (c.rarity ?? '').toUpperCase(),
              combinedName: `${tcgName}  ${cardNumber}`.trim(),
              raw: c,
            };
          }).filter(Boolean));
        })
        .catch(err => { if (err.name !== 'AbortError') console.warn('search fail', err); setResults([]); })
        .finally(() => setLoadingResults(false));
    }, 300);

    return () => { clearTimeout(handle); controller.abort(); };
  }, [modalText, open, mode]);

  // Pack search
  const searchPack = useCallback(async () => {
    const q = packQuery.trim();
    if (!q) return;
    setLoadingPack(true); setPackError(null); setPackResults([]);
    setBulkSelected(new Set()); setRarityFilters(new Set()); setSpecialFilters(new Set());
    try {
      const url = new URL('https://digimoncard.io/api-public/search');
      url.searchParams.append('pack', q);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setPackError('No cards found for that pack. Check the pack code and try again.');
        setLoadingPack(false); return;
      }
      setPackResults(data.map((c: any) => ({
        tcgplayer_id: c.tcgplayer_id ? String(c.tcgplayer_id) : null,
        tcgplayer_name: c.tcgplayer_name ?? '',
        card_name: c.name ?? '',
        card_number: c.id ?? c.card_number ?? '',
        rarity: (c.rarity ?? '').toUpperCase(),
        raw: c,
      })).filter((c: any) => c.tcgplayer_id));
    } catch { setPackError('Failed to fetch pack. Please try again.'); }
    finally { setLoadingPack(false); }
  }, [packQuery]);

  const filteredPackResults = packResults.filter(card => {
    const hasSpecial = isSpecialVariant(card.tcgplayer_name);
    const rarityActive = rarityFilters.size > 0;
    const specialActive = specialFilters.size > 0;
    if (!rarityActive && !specialActive) return true;
    if (specialActive && hasSpecial) return matchesSpecialFilter(card.tcgplayer_name, specialFilters);
    if (rarityActive && !hasSpecial) return rarityFilters.has(card.rarity as Rarity);
    return false;
  });

  // ── Selected items helpers ──────────────────────────────────────────────

  const addItem = (r: any) => {
    setSelectedItems(prev => {
      if (prev.some(p => p.id === r.id)) return prev;
      return [...prev, {
        id:             r.id,
        tcgplayer_id:   String(r.tcgplayer_id ?? r.id),
        tcgplayer_name: r.tcgplayer_name,
        card_number:    r.card_number,
        rarity:         r.rarity,
        combinedName:   r.combinedName,
        quantity:       null,
        raw:            r.raw,
      }];
    });
    setModalText(''); setResults([]);
  };

  const removeItem = (id: string) => setSelectedItems(prev => prev.filter(p => p.id !== id));

  // null → 1 → 2 … (incrementing)
  const incrementQty = (id: string) => {
    setSelectedItems(prev => prev.map(p =>
      p.id === id ? { ...p, quantity: p.quantity === null ? 1 : p.quantity + 1 } : p
    ));
  };

  // 1 → null, null stays null
  const decrementQty = (id: string) => {
    setSelectedItems(prev => prev.map(p => {
      if (p.id !== id) return p;
      if (p.quantity === null || p.quantity <= 1) return { ...p, quantity: null };
      return { ...p, quantity: p.quantity - 1 };
    }));
  };


  const incrementAllQty = () => {
    setSelectedItems(prev =>
      prev.map(p => ({
        ...p,
        quantity: p.quantity === null ? 1 : p.quantity + 1,
      }))
    );
  };
  
  const decrementAllQty = () => {
    setSelectedItems(prev =>
      prev.map(p => {
        if (p.quantity === null || p.quantity <= 1) {
          return { ...p, quantity: null };
        }
        return { ...p, quantity: p.quantity - 1 };
      })
    );
  };

  const setAllQty = (value: number | null) => {
    setSelectedItems(prev =>
      prev.map(p => ({
        ...p,
        quantity: value,
      }))
    );
  };

  const handleBulkQtyChange = (val: string) => {
    setBulkQtyInput(val);
  
    if (val.trim() === '') {
      setAllQty(null); // reset to "unset"
      return;
    }
  
    const num = Number(val);
    if (!Number.isNaN(num) && num >= 0) {
      setAllQty(num);
    }
  };


  // Bulk helpers
  const toggleBulkCard    = (tcgId: string)      => { setBulkSelected(prev => { const n = new Set(prev); n.has(tcgId) ? n.delete(tcgId) : n.add(tcgId); return n; }); };
  const selectAllVisible  = ()                   => { setBulkSelected(prev => { const n = new Set(prev); filteredPackResults.forEach(c => { if (c.tcgplayer_id) n.add(c.tcgplayer_id); }); return n; }); };
  const deselectAllVisible = ()                  => { setBulkSelected(prev => { const n = new Set(prev); filteredPackResults.forEach(c => { if (c.tcgplayer_id) n.delete(c.tcgplayer_id); }); return n; }); };
  const toggleRarity       = (r: Rarity)         => { setRarityFilters(prev => { const n = new Set(prev); n.has(r) ? n.delete(r) : n.add(r); return n; }); };
  const toggleSpecial      = (s: SpecialVariant) => { setSpecialFilters(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; }); };

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    if (selectedItems.length === 0) return;
    onAdd(selectedItems.map(item => ({
      id:             item.id,
      tcgplayer_id:   item.tcgplayer_id,
      tcgplayer_name: item.tcgplayer_name,
      card_number:    item.card_number,
      rarity:         (item.rarity ?? '').toUpperCase(),
      combinedName:   item.combinedName,
      quantity:       item.quantity,
      raw:            item.raw,
    })));
    setSelectedItems([]);
  }, [selectedItems, onAdd]);

  const handleBulkAdd = useCallback(() => {
    const toAdd = packResults
      .filter(c => c.tcgplayer_id && bulkSelected.has(c.tcgplayer_id))
      .map(c => ({
        id:             c.tcgplayer_id,
        tcgplayer_id:   c.tcgplayer_id,
        tcgplayer_name: c.tcgplayer_name,
        card_number:    c.card_number,
        rarity:         (c.rarity ?? '').toUpperCase(),
        combinedName:   `${c.tcgplayer_name}  ${c.card_number}`.trim(),
        quantity:       null,
        raw:            c.raw,
      }));
    if (toAdd.length > 0) onAdd(toAdd);
  }, [packResults, bulkSelected, onAdd]);

  if (!open) return null;

  const allVisibleSelected = filteredPackResults.length > 0 && filteredPackResults.every(c => bulkSelected.has(c.tcgplayer_id));
  const hasSelected        = selectedItems.length > 0;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: mode === 'bulk' ? 860 : hasSelected ? 760 : 480,
          maxHeight: '90vh',
          background: '#111115',
          border: '1px solid #2a2a32',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          fontFamily: "'DM Sans','Segoe UI',sans-serif",
          display: 'flex',
          flexDirection: 'column',
          transition: 'max-width 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: '14px 20px 0', borderBottom: '1px solid #1e1e24', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 2, background: '#0e0e12', borderRadius: 8, padding: 3 }}>
              {(['search', 'bulk'] as Mode[]).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{ padding: '5px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: mode === m ? '#1e1e28' : 'transparent', color: mode === m ? '#e8e6e0' : '#555' }}>
                  {m === 'search' ? '🔍 Search' : '📦 Add Bulk'}
                </button>
              ))}
            </div>
            <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #2a2a32', background: 'transparent', color: '#555', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>

          {/* Search input */}
          {mode === 'search' && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', paddingBottom: 14 }}>
              <svg style={{ position: 'absolute', left: 10, width: 14, height: 14, color: '#444', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef}
                value={modalText}
                onChange={e => setModalText(e.target.value)}
                placeholder="Type to search cards…"
                style={{ width: '100%', padding: '9px 36px 9px 32px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 8, color: '#e8e6e0', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              />
              {loadingResults && <div style={{ position: 'absolute', right: 10, width: 14, height: 14, border: '2px solid #2a2a32', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
            </div>
          )}

          {/* Bulk header */}
          {mode === 'bulk' && (
            <div style={{ paddingBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input ref={packInputRef} value={packQuery} onChange={e => setPackQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPack()} placeholder="Pack code, e.g. BT18" style={{ flex: 1, padding: '8px 12px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 8, color: '#e8e6e0', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={searchPack} disabled={loadingPack || !packQuery.trim()} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: loadingPack || !packQuery.trim() ? '#1e1e28' : '#4f46e5', color: loadingPack || !packQuery.trim() ? '#444' : '#fff', fontSize: 13, fontWeight: 600, cursor: loadingPack || !packQuery.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {loadingPack ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #444', borderTopColor: '#888', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Loading…</span> : 'Search Pack'}
                </button>
              </div>
              {packResults.length > 0 && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Rarity</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {RARITIES.map(r => { const active = rarityFilters.has(r); return <button key={r} onClick={() => toggleRarity(r)} style={{ padding: '3px 10px', borderRadius: 99, border: `1px solid ${active ? RARITY_COLOURS[r] : '#2a2a32'}`, background: active ? `${RARITY_COLOURS[r]}22` : 'transparent', color: active ? RARITY_COLOURS[r] : '#555', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{r}</button>; })}
                      {rarityFilters.size > 0 && <button onClick={() => setRarityFilters(new Set())} style={{ padding: '3px 8px', borderRadius: 99, border: '1px solid #2a2a32', background: 'transparent', color: '#444', fontSize: 11, cursor: 'pointer' }}>clear</button>}
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Special Variants</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {SPECIAL_VARIANTS.map(s => { const active = specialFilters.has(s); return <button key={s} onClick={() => toggleSpecial(s)} style={{ padding: '3px 10px', borderRadius: 99, border: `1px solid ${active ? '#a78bfa' : '#2a2a32'}`, background: active ? '#a78bfa22' : 'transparent', color: active ? '#a78bfa' : '#555', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{s}</button>; })}
                      {specialFilters.size > 0 && <button onClick={() => setSpecialFilters(new Set())} style={{ padding: '3px 8px', borderRadius: 99, border: '1px solid #2a2a32', background: 'transparent', color: '#444', fontSize: 11, cursor: 'pointer' }}>clear</button>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                    <span style={{ fontSize: 11, color: '#444' }}>{filteredPackResults.length} card{filteredPackResults.length !== 1 ? 's' : ''} shown{bulkSelected.size > 0 && ` · ${bulkSelected.size} selected`}</span>
                    <button onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #2a2a32', background: 'transparent', color: '#888', fontSize: 11, cursor: 'pointer' }}>{allVisibleSelected ? 'Deselect all' : 'Select all'}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Body: two-column when items selected (search mode) ── */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* Left: results / bulk grid */}
          <div style={{ flex: 1, overflowY: 'auto', borderRight: hasSelected && mode === 'search' ? '1px solid #1e1e24' : 'none' }}>

            {/* Search results */}
            {mode === 'search' && modalText.trim().length > 0 && (
              <>
                {!loadingResults && results.length === 0 && <div style={{ padding: '20px', fontSize: 13, color: '#444', textAlign: 'center' }}>No results</div>}
                {results.map(r => {
                  const alreadySelected = selectedItems.some(p => p.id === r.id);
                  const imgSrc = r.tcgplayer_id ? `https://tcgplayer-cdn.tcgplayer.com/product/${r.tcgplayer_id}_in_200x200.jpg` : null;
                  return (
                    <button
                      key={r.tcgplayer_id || r.id}
                      onClick={() => { if (!alreadySelected) addItem(r); }}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 16px', background: alreadySelected ? '#141420' : 'transparent', border: 'none', borderBottom: '1px solid #18181e', cursor: alreadySelected ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                      onMouseEnter={e => { if (!alreadySelected) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a22'; }}
                      onMouseLeave={e => { if (!alreadySelected) (e.currentTarget as HTMLButtonElement).style.background = alreadySelected ? '#141420' : 'transparent'; }}
                    >
                      <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: '#18181e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {imgSrc ? <img src={imgSrc} alt={r.tcgplayer_name} style={{ width: 44, height: 44, objectFit: 'contain' }} /> : <span style={{ fontSize: 10, color: '#333' }}>—</span>}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: alreadySelected ? '#555' : '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.tcgplayer_name || r.id}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                          {r.card_number && <span style={{ fontSize: 11, fontFamily: 'monospace', color: alreadySelected ? '#444' : '#555' }}>{r.card_number}</span>}
                          {r.rarity && <span style={{ fontSize: 10, fontWeight: 700, color: RARITY_COLOURS[r.rarity] ?? '#555' }}>{r.rarity}</span>}
                        </div>
                      </div>
                      {alreadySelected
                        ? <span style={{ fontSize: 11, color: '#4f46e5', flexShrink: 0 }}>added</span>
                        : <span style={{ fontSize: 18, color: '#333', flexShrink: 0 }}>+</span>}
                    </button>
                  );
                })}
              </>
            )}

            {mode === 'search' && modalText.trim().length === 0 && !hasSelected && (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: '#333', fontSize: 13 }}>Start typing to search cards</div>
            )}
            {mode === 'search' && modalText.trim().length === 0 && hasSelected && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#333', fontSize: 13 }}>Search for more cards to add →</div>
            )}

            {/* Bulk */}
            {mode === 'bulk' && packError && <div style={{ padding: '24px 20px', textAlign: 'center', color: '#c0392b', fontSize: 13 }}>{packError}</div>}
            {mode === 'bulk' && !packError && packResults.length === 0 && !loadingPack && <div style={{ padding: '28px 20px', textAlign: 'center', color: '#333', fontSize: 13 }}>Enter a pack code above to load all cards from that set.</div>}
            {mode === 'bulk' && filteredPackResults.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, padding: '12px 16px' }}>
                {filteredPackResults.map(card => {
                  const sel = bulkSelected.has(card.tcgplayer_id);
                  const rColor = RARITY_COLOURS[card.rarity] ?? '#555';
                  const parenText = extractParenText(card.tcgplayer_name);
                  return (
                    <div key={card.tcgplayer_id} onClick={() => toggleBulkCard(card.tcgplayer_id)} style={{ position: 'relative', borderRadius: 8, border: `2px solid ${sel ? '#4f46e5' : '#1e1e24'}`, background: sel ? '#16182a' : '#16161c', cursor: 'pointer', transition: 'all 0.12s', overflow: 'hidden', padding: '6px 6px 4px' }} onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = '#2a2a3a'; }} onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = '#1e1e24'; }}>
                      <div style={{ position: 'absolute', top: 5, right: 5, zIndex: 2, width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${sel ? '#4f46e5' : '#2a2a32'}`, background: sel ? '#4f46e5' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sel && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
                      </div>
                      <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`} alt={card.tcgplayer_name} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'contain', borderRadius: 4, display: 'block' }} />
                      <div style={{ fontSize: 9, color: '#555', fontFamily: 'monospace', marginTop: 3, textAlign: 'center' }}>{card.card_name}</div>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, marginTop: 2 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: rColor }}>{card.rarity}</span>
                        {parenText && <span style={{ fontSize: 8, color: '#a78bfa', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60 }}>{parenText}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {mode === 'bulk' && packResults.length > 0 && filteredPackResults.length === 0 && <div style={{ padding: '24px 20px', textAlign: 'center', color: '#333', fontSize: 13 }}>No cards match the selected filters.</div>}
          </div>

          {/* ── Right panel: selected items with qty controls ── */}
          {mode === 'search' && hasSelected && (
            <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#0e0e12' }}>
              {/* Panel header */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e1e24', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {selectedItems.length} selected
                </span>
                <div style={{ display: 'flex', alignItems: 'center', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 6, overflow: 'hidden' }}>
                        <button
                          onClick={decrementAllQty}
                          style={{ width: 28, height: 26, background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#e8e6e0')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                        >−</button>
                        <input
                          value={bulkQtyInput}
                          onChange={e => handleBulkQtyChange(e.target.value)}
                          placeholder="Set"
                          style={{
                            width: 40,
                            height: 26,
                            textAlign: 'center',
                            background: '#18181e',
                            border: '1px solid #2a2a32',
                            borderRadius: 6,
                            color: '#d4d2cc',
                            fontSize: 12,
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={incrementAllQty}
                          style={{ width: 28, height: 26, background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#e8e6e0')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                        >+</button>
                      </div>
                <button onClick={() => setSelectedItems([])} style={{ fontSize: 10, color: '#444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                  Clear all
                </button>
              </div>

              {/* Scrollable list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
                {selectedItems.map(item => (
                  <div key={item.id} style={{ padding: '10px 14px', borderBottom: '1px solid #18181e' }}>

                    {/* Card row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <img
                        src={`https://tcgplayer-cdn.tcgplayer.com/product/${item.tcgplayer_id}_in_200x200.jpg`}
                        alt={item.tcgplayer_name}
                        style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.tcgplayer_name}
                        </div>
                        <div style={{ display: 'flex', gap: 5, marginTop: 1, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>{item.card_number}</span>
                          {item.rarity && <span style={{ fontSize: 9, fontWeight: 700, color: RARITY_COLOURS[item.rarity] ?? '#555' }}>{item.rarity}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #2a2a32', background: 'transparent', color: '#444', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#c0392b'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#c0392b'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#444'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a32'; }}
                      >×</button>
                    </div>

                    {/* Qty stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, flexShrink: 0 }}>Qty</span>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 6, overflow: 'hidden' }}>
                        <button
                          onClick={() => decrementQty(item.id)}
                          style={{ width: 28, height: 26, background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#e8e6e0')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                        >−</button>
                        <div style={{ minWidth: 36, textAlign: 'center', fontSize: 13, fontWeight: 600, color: item.quantity === null ? '#2a2a32' : '#d4d2cc', borderLeft: '1px solid #2a2a32', borderRight: '1px solid #2a2a32', lineHeight: '26px', userSelect: 'none' }}>
                          {item.quantity === null ? '—' : item.quantity}
                        </div>
                        <button
                          onClick={() => incrementQty(item.id)}
                          style={{ width: 28, height: 26, background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#e8e6e0')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                        >+</button>
                      </div>
                      {item.quantity === null && (
                        <span style={{ fontSize: 10, color: '#2a2a32', fontStyle: 'italic' }}>unset</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #1e1e24', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          {mode === 'search' ? (
            <>
              <span style={{ fontSize: 12, color: '#444' }}>
                {selectedItems.length > 0 ? `${selectedItems.length} card${selectedItems.length > 1 ? 's' : ''} selected` : 'No cards selected'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setModalText(''); setResults([]); setSelectedItems([]); onClose(); }} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #2a2a32', background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleAdd} disabled={selectedItems.length === 0} style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: selectedItems.length === 0 ? '#1e1e28' : '#4f46e5', color: selectedItems.length === 0 ? '#444' : '#fff', fontSize: 12, fontWeight: 600, cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer' }}>
                  Add{selectedItems.length > 0 ? ` ${selectedItems.length} card${selectedItems.length > 1 ? 's' : ''}` : ''}
                </button>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: 12, color: '#444' }}>{bulkSelected.size > 0 ? `${bulkSelected.size} card${bulkSelected.size > 1 ? 's' : ''} selected` : 'No cards selected'}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #2a2a32', background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleBulkAdd} disabled={bulkSelected.size === 0} style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: bulkSelected.size === 0 ? '#1e1e28' : '#4f46e5', color: bulkSelected.size === 0 ? '#444' : '#fff', fontSize: 12, fontWeight: 600, cursor: bulkSelected.size === 0 ? 'not-allowed' : 'pointer' }}>
                  Add {bulkSelected.size > 0 ? `${bulkSelected.size} card${bulkSelected.size > 1 ? 's' : ''}` : ''}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}