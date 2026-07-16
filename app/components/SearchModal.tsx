'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import SelectedCard from './SelectedCard';

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
  price: number | null;
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

const rarityClass = (rarity: string) => rarity ? `ca-rarity-${rarity.toLowerCase()}` : '';

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
        price:          r.price,
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
      price:          item.price,
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
        price:          c.price,
        raw:            c.raw,
      }));
    if (toAdd.length > 0) onAdd(toAdd);
  }, [packResults, bulkSelected, onAdd]);

  const updatePrice = (id: string, value: string) => {
  setSelectedItems(prev =>
    prev.map(item => {
      if (item.id !== id) return item;

      return {
        ...item,
        price:
          value.trim() === ''
            ? null
            : Number.isNaN(Number(value))
              ? item.price
              : Number(value),
      };
    })
  );
};

  if (!open) return null;

  const allVisibleSelected = filteredPackResults.length > 0 && filteredPackResults.every(c => bulkSelected.has(c.tcgplayer_id));
  const hasSelected        = selectedItems.length > 0;

  const modalSizeClass = mode === 'bulk' ? 'ca-searchmodal--bulk' : hasSelected ? 'ca-searchmodal--split' : 'ca-searchmodal--compact';

  return (
    <div
      onClick={onClose}
      className="ca-modal-overlay"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`ca-searchmodal ${modalSizeClass}`}
      >
        {/* ── Header ── */}
        <div className="ca-searchmodal-header">
          <div className="ca-searchmodal-header-row">
            <div className="ca-mode-tabbar">
              {(['search', 'bulk'] as Mode[]).map(m => (
                <button key={m} onClick={() => setMode(m)} className={`ca-mode-tab${mode === m ? ' is-active' : ''}`}>
                  {m === 'search' ? '🔍 Search' : '📦 Add Bulk'}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="ca-icon-btn ca-icon-btn--sm">×</button>
          </div>

          {/* Search input */}
          {mode === 'search' && (
            <div className="ca-searchmodal-input-wrap">
              <svg className="ca-searchmodal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef}
                value={modalText}
                onChange={e => setModalText(e.target.value)}
                placeholder="Type to search cards…"
                className="ca-searchmodal-input"
              />
              {loadingResults && <span className="ca-searchmodal-spinner"><span className="ca-spinner" /></span>}
            </div>
          )}

          {/* Bulk header */}
          {mode === 'bulk' && (
            <div style={{ paddingBottom: 14 }}>
              <div className="ca-bulk-search-row">
                <input ref={packInputRef} value={packQuery} onChange={e => setPackQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPack()} placeholder="Pack code, e.g. BT18" className="ca-pack-input" />
                <button onClick={searchPack} disabled={loadingPack || !packQuery.trim()} className="ca-pack-search-btn">
                  {loadingPack ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="ca-spinner ca-spinner--light" style={{ width: 12, height: 12 }} />Loading…</span> : 'Search Pack'}
                </button>
              </div>
              {packResults.length > 0 && (
                <>
                  <div className="ca-filter-section">
                    <div className="ca-th-label" style={{ marginBottom: 6 }}>Rarity</div>
                    <div className="ca-filter-pills">
                      {RARITIES.map(r => { const active = rarityFilters.has(r); return <button key={r} onClick={() => toggleRarity(r)} className={`ca-rarity-pill-filter${active ? ` is-active ${rarityClass(r)}` : ''}`}>{r}</button>; })}
                      {rarityFilters.size > 0 && <button onClick={() => setRarityFilters(new Set())} className="ca-filter-clear-btn">clear</button>}
                    </div>
                  </div>
                  <div className="ca-filter-section">
                    <div className="ca-th-label" style={{ marginBottom: 6 }}>Special Variants</div>
                    <div className="ca-filter-pills">
                      {SPECIAL_VARIANTS.map(s => { const active = specialFilters.has(s); return <button key={s} onClick={() => toggleSpecial(s)} className={`ca-special-pill-filter${active ? ' is-active' : ''}`}>{s}</button>; })}
                      {specialFilters.size > 0 && <button onClick={() => setSpecialFilters(new Set())} className="ca-filter-clear-btn">clear</button>}
                    </div>
                  </div>
                  <div className="ca-filter-summary-row">
                    <span className="ca-filter-count">{filteredPackResults.length} card{filteredPackResults.length !== 1 ? 's' : ''} shown{bulkSelected.size > 0 && ` · ${bulkSelected.size} selected`}</span>
                    <button onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible} className="ca-select-all-btn">{allVisibleSelected ? 'Deselect all' : 'Select all'}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Body: two-column when items selected (search mode) ── */}
        <div className="ca-searchmodal-body">

          {/* Left: results / bulk grid */}
          <div className={`ca-searchmodal-results${hasSelected && mode === 'search' ? ' ca-searchmodal-results--bordered' : ''}`}>

            {/* Search results */}
            {mode === 'search' && modalText.trim().length > 0 && (
              <>
                {!loadingResults && results.length === 0 && <div className="ca-searchmodal-hint">No results</div>}
                {results.map(r => {
                  const alreadySelected = selectedItems.some(p => p.id === r.id);
                  const imgSrc = r.tcgplayer_id ? `https://tcgplayer-cdn.tcgplayer.com/product/${r.tcgplayer_id}_in_200x200.jpg` : null;
                  return (
                    <button
                      key={r.tcgplayer_id || r.id}
                      onClick={() => { if (!alreadySelected) addItem(r); }}
                      className={`ca-result-row${alreadySelected ? ' is-added' : ''}`}
                    >
                      <div className="ca-result-thumb-wrap">
                        {imgSrc ? <img src={imgSrc} alt={r.tcgplayer_name} className="ca-result-thumb" /> : <span className="ca-result-thumb-placeholder">—</span>}
                      </div>
                      <div className="ca-result-info">
                        <div className={`ca-result-name${alreadySelected ? ' is-added' : ''}`}>{r.tcgplayer_name || r.id}</div>
                        <div className="ca-result-meta-row">
                          {r.card_number && <span className={`ca-result-number${alreadySelected ? ' is-added' : ''}`}>{r.card_number}</span>}
                          {r.rarity && <span className={`ca-result-rarity ${rarityClass(r.rarity)}`}>{r.rarity}</span>}
                        </div>
                      </div>
                      {alreadySelected
                        ? <span className="ca-result-indicator is-added">added</span>
                        : <span className="ca-result-indicator">+</span>}
                    </button>
                  );
                })}
              </>
            )}

            {mode === 'search' && modalText.trim().length === 0 && !hasSelected && (
              <div className="ca-searchmodal-hint">Start typing to search cards</div>
            )}
            {mode === 'search' && modalText.trim().length === 0 && hasSelected && (
              <div className="ca-searchmodal-hint ca-searchmodal-hint--sm">Search for more cards to add →</div>
            )}

            {/* Bulk */}
            {mode === 'bulk' && packError && <div className="ca-searchmodal-hint" style={{ color: 'var(--ca-red)' }}>{packError}</div>}
            {mode === 'bulk' && !packError && packResults.length === 0 && !loadingPack && <div className="ca-searchmodal-hint">Enter a pack code above to load all cards from that set.</div>}
            {mode === 'bulk' && filteredPackResults.length > 0 && (
              <div className="ca-bulk-grid">
                {filteredPackResults.map(card => {
                  const sel = bulkSelected.has(card.tcgplayer_id);
                  const parenText = extractParenText(card.tcgplayer_name);
                  return (
                    <div key={card.tcgplayer_id} onClick={() => toggleBulkCard(card.tcgplayer_id)} className={`ca-bulk-tile${sel ? ' is-selected' : ''}`}>
                      <div className={`ca-bulk-tile-check${sel ? ' is-selected' : ''}`}>
                        {sel && <span className="ca-checkbox-mark">✓</span>}
                      </div>
                      <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`} alt={card.tcgplayer_name} className="ca-bulk-tile-img" />
                      <div className="ca-bulk-tile-name">{card.card_name}</div>
                      <div className="ca-bulk-tile-meta-row">
                        <span className={`ca-bulk-tile-rarity ${rarityClass(card.rarity)}`}>{card.rarity}</span>
                        {parenText && <span className="ca-bulk-tile-special">{parenText}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {mode === 'bulk' && packResults.length > 0 && filteredPackResults.length === 0 && <div className="ca-searchmodal-hint">No cards match the selected filters.</div>}
          </div>

          {/* ── Right panel: selected items with qty controls ── */}
          {mode === 'search' && hasSelected && (
            <div className="ca-searchmodal-panel">
              {/* Panel header */}
              <div className="ca-searchmodal-panel-header">
                <span className="ca-panel-header-label">
                  {selectedItems.length} selected
                </span>
                <div className="ca-qty-stepper">
                        <button
                          onClick={decrementAllQty}
                          className="ca-qty-stepper-btn ca-qty-stepper-btn--sm"
                        >−</button>
                        <input
                          value={bulkQtyInput}
                          onChange={e => handleBulkQtyChange(e.target.value)}
                          placeholder="Set"
                          className="ca-qty-stepper-input"
                        />
                        <button
                          onClick={incrementAllQty}
                          className="ca-qty-stepper-btn ca-qty-stepper-btn--sm"
                        >+</button>
                      </div>
                <button onClick={() => setSelectedItems([])} className="ca-clear-all-btn">
                  Clear all
                </button>
              </div>

              {/* Scrollable list */}
              <div className="ca-selected-items-scroll">
                <div className="ca-selected-items-list">
                  {selectedItems.map(item => (
                    <SelectedCard
                      key={item.id}
                      item={item}
                      onRemove={removeItem}
                      onIncrementQty={incrementQty}
                      onDecrementQty={decrementQty}
                      onPriceChange={updatePrice}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="ca-modal-footer">
          {mode === 'search' ? (
            <>
              <span className="ca-footer-text">
                {selectedItems.length > 0 ? `${selectedItems.length} card${selectedItems.length > 1 ? 's' : ''} selected` : 'No cards selected'}
              </span>
              <div className="ca-footer-btn-group">
                <button onClick={() => { setModalText(''); setResults([]); setSelectedItems([]); onClose(); }} className="ca-btn ca-btn-ghost ca-btn-md">Cancel</button>
                <button onClick={handleAdd} disabled={selectedItems.length === 0} className="ca-btn ca-btn-primary ca-btn-md">
                  Add{selectedItems.length > 0 ? ` ${selectedItems.length} card${selectedItems.length > 1 ? 's' : ''}` : ''}
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="ca-footer-text">{bulkSelected.size > 0 ? `${bulkSelected.size} card${bulkSelected.size > 1 ? 's' : ''} selected` : 'No cards selected'}</span>
              <div className="ca-footer-btn-group">
                <button onClick={onClose} className="ca-btn ca-btn-ghost ca-btn-md">Cancel</button>
                <button onClick={handleBulkAdd} disabled={bulkSelected.size === 0} className="ca-btn ca-btn-primary ca-btn-md">
                  Add {bulkSelected.size > 0 ? `${bulkSelected.size} card${bulkSelected.size > 1 ? 's' : ''}` : ''}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
