'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (item: any) => void;
};

export default function SearchModal({ open, onClose, onAdd }: Props) {
  const [modalText, setModalText] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── focus on open ──
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setModalText(''); setResults([]); setSelectedCard(null); setSelectedItems([]); }
  }, [open]);

  const removeSelectedItem = (id: any) => {
    setSelectedItems((prev) => prev.filter((p) => p.id !== id));
    setModalText('');
    setResults([]);
    setSelectedCard(null);
  };

  const handleAdd = useCallback(() => {
    if (selectedItems.length > 0) {
      onAdd(selectedItems);
    } else if (selectedCard) {
      onAdd(selectedCard);
    } else {
      onAdd(modalText);
    }
    setModalText('');
    setResults([]);
    setSelectedCard(null);
    setSelectedItems([]);
  }, [modalText, selectedCard, onAdd, selectedItems]);

  // ── search logic — unchanged from original ──
  useEffect(() => {
    if (!open) return;

    const q = modalText.trim();
    if (!q) {
      setResults([]);
      setLoadingResults(false);
      return;
    }

    const controller = new AbortController();
    const handle = setTimeout(() => {
      setLoadingResults(true);

      const parts = q.split(/\s+/).filter(Boolean);
      let cardToken: string | undefined = parts.find((p) => p.includes('-'));
      if (!cardToken) {
        const maybe = parts.find((p) => /^[a-z0-9]+\-?[a-z0-9]+$/i.test(p) && /\d/.test(p));
        if (maybe && maybe.includes('-')) cardToken = maybe;
      }

      const nameParts = parts.filter((p) => p !== cardToken);
      const nameQuery = nameParts.join(' ').trim();

      const params: Record<string, string> = {};
      if (cardToken) params.card = cardToken;
      if (nameQuery) params.n = nameQuery;
      if (!cardToken && !nameQuery) params.n = q;

      const url = new URL('https://digimoncard.io/api-public/search');
      Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

      fetch(url.toString(), { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          if (!Array.isArray(data)) { setResults([]); return; }
          const mapped = data
            .map((c: any) => {
              const cardNumber = c.id ?? c.card_number ?? c.cardNumber ?? '';
              const tcgName = c.tcgplayer_name ?? '';
              return {
                id: c.tcgplayer_id ? String(c.tcgplayer_id) : String(c.id ?? ''),
                tcgplayer_name: tcgName,
                tcgplayer_id: c.tcgplayer_id,
                card_number: cardNumber,
                combinedName: `${tcgName}  ${cardNumber}`.trim(),
                raw: c,
              };
            })
            .filter(Boolean);
          setResults(mapped);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') console.warn('search fail', err);
          setResults([]);
        })
        .finally(() => setLoadingResults(false));
    }, 300);

    return () => { clearTimeout(handle); controller.abort(); };
  }, [modalText, open]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: '#111115', border: '1px solid #2a2a32', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', fontFamily: "'DM Sans','Segoe UI',sans-serif" }}
      >
        {/* ── header ── */}
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #1e1e24' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e6e0' }}>Add cards</span>
            <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #2a2a32', background: 'transparent', color: '#555', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>

          {/* selected chips */}
          {selectedItems.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {selectedItems.map((it) => (
                <div
                  key={it.id || it.card_number || it.tcgplayer_id}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 10px', background: '#1e1e32', border: '1px solid #3a3a52', borderRadius: 99, fontSize: 12, color: '#a0a0d0' }}
                >
                  <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.combinedName || it.tcgplayer_name || it.id}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeSelectedItem(it.id); }}
                    style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', background: '#2e2e42', color: '#888', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* search input */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg style={{ position: 'absolute', left: 10, width: 14, height: 14, color: '#444', flexShrink: 0, pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              value={modalText}
              onChange={(e) => { setModalText(e.target.value); setSelectedCard(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              aria-label="Add search input"
              placeholder="Type to search..."
              style={{ width: '100%', padding: '9px 36px 9px 32px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 8, color: '#e8e6e0', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            />
            {loadingResults && (
              <div style={{ position: 'absolute', right: 10, width: 14, height: 14, border: '2px solid #2a2a32', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            )}
          </div>
        </div>

        {/* ── results ── */}
        {modalText.trim().length > 0 && (
          <div style={{ maxHeight: 260, overflowY: 'auto', borderBottom: '1px solid #1e1e24' }}>
            {!loadingResults && results.length === 0 && (
              <div style={{ padding: '20px', fontSize: 13, color: '#444', textAlign: 'center' }}>No results</div>
            )}
            {results.map((r) => {
              const alreadySelected = selectedItems.some((p) => p.id === r.id);
              return (
                <button
                  key={r.tcgplayer_id || r.id || r.tcgplayer_name}
                  onClick={() => {
                    if (alreadySelected) return;
                    setSelectedItems((prev) => {
                      const exists = prev.some((p) => p.id === r.id);
                      if (exists) return prev;
                      return [...prev, { id: r.id, combinedName: r.combinedName, tcgplayer_name: r.tcgplayer_name, card_number: r.card_number, raw: r.raw }];
                    });
                    setModalText('');
                    setResults([]);
                    setSelectedCard(null);
                  }}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 20px', background: alreadySelected ? '#141420' : 'transparent', border: 'none', borderBottom: '1px solid #18181e', cursor: alreadySelected ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                  onMouseEnter={e => { if (!alreadySelected) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a22'; }}
                  onMouseLeave={e => { if (!alreadySelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: alreadySelected ? '#555' : '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.tcgplayer_name || r.combinedName || r.id}
                      {r.card_number && (
                        <span style={{ marginLeft: 7, fontSize: 11, fontFamily: 'monospace', fontWeight: 400, color: alreadySelected ? '#444' : '#666' }}>
                          {r.card_number}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#444', fontFamily: 'monospace', marginTop: 2 }}>
                      tcg:{r.tcgplayer_id}
                    </div>
                  </div>
                  {alreadySelected
                    ? <span style={{ fontSize: 11, color: '#4f46e5', flexShrink: 0 }}>added</span>
                    : <span style={{ fontSize: 18, color: '#333', flexShrink: 0 }}>+</span>
                  }
                </button>
              );
            })}
          </div>
        )}

        {/* empty state */}
        {modalText.trim().length === 0 && selectedItems.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: '#333', fontSize: 13 }}>
            Start typing to search cards
          </div>
        )}

        {/* ── footer ── */}
        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#444' }}>
            {selectedItems.length > 0 ? `${selectedItems.length} card${selectedItems.length > 1 ? 's' : ''} selected` : 'No cards selected'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setModalText(''); setResults([]); setSelectedCard(null); onClose(); }}
              style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #2a2a32', background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selectedItems.length === 0}
              style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: selectedItems.length === 0 ? '#1e1e28' : '#4f46e5', color: selectedItems.length === 0 ? '#444' : '#fff', fontSize: 12, fontWeight: 600, cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              Add{selectedItems.length > 0 ? ` ${selectedItems.length} card${selectedItems.length > 1 ? 's' : ''}` : ''}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}