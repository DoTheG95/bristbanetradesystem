'use client';

import React, { useCallback, useEffect, useState } from 'react';

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
          if (!Array.isArray(data)) {
            setResults([]);
            return;
          }
          const mapped = data
            .map((c: any) => {
              const cardNumber = c.card_number ?? c.cardNumber ?? c.id ?? '';
              const tcgName = c.tcgplayer_name ?? '';
              return {
                id: c.id,
                tcgplayer_name: tcgName,
                tcgplayer_id: c.tcgplayer_id,
                card_number: cardNumber,
                combinedName: `${tcgName}  ${cardNumber}`.trim(),
                raw: c,
              };
            })
            .filter(Boolean)
          setResults(mapped);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') console.warn('search fail', err);
          setResults([]);
        })
        .finally(() => setLoadingResults(false));
    }, 300);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [modalText, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-lg p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg text-black font-medium mb-3">Add Search</h2>
        <div className="relative">
          {selectedItems.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedItems.map((it) => (
                <div
                  key={it.id || it.card_number || it.tcgplayer_id}
                  className="flex items-center gap-2 px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm"
                >
                  <span className="select-none">{it.combinedName || it.tcgplayer_name || it.id}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${it.combinedName || it.tcgplayer_name || it.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSelectedItem(it.id);
                    }}
                    className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-indigo-200 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            value={modalText}
            onChange={(e) => {
              setModalText(e.target.value);
              setSelectedCard(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            aria-label="Add search input"
            placeholder="Type to search..."
            className="w-full text-black px-3 py-2 border border-gray-300 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />

          <div className="absolute left-0 right-0 mt-1 z-40">
            <div className="max-h-56 overflow-auto bg-white border border-gray-200 rounded shadow">
              {loadingResults && <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>}
              {!loadingResults && results.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">No results</div>}
              {results.map((r) => (
                <button
                  key={r.tcgplayer_id || r.id || r.tcgplayer_name}
                  onClick={() => {
                    // add to selected items as a removable chip
                    setSelectedItems((prev) => {
                      const exists = prev.some((p) => p.id === r.id);
                      if (exists) return prev;
                      return [...prev, { id: r.id, combinedName: r.combinedName, tcgplayer_name: r.tcgplayer_name, card_number: r.card_number, raw: r.raw }];
                    });
                    // clear input so user can search again
                    setModalText('');
                    setResults([]);
                    setSelectedCard(null);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                >
                  <div className="text-sm font-medium text-gray-900">{r.combinedName || r.tcgplayer_name || r.id}</div>
                  <div className="text-xs text-gray-500">card_number: {r.card_number} · tcgplayer_id: {r.tcgplayer_id}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={handleAdd} className="px-3 py-1 rounded bg-indigo-500 text-white hover:bg-indigo-700">Add</button>
          <button
            onClick={() => {
              setModalText('');
              setResults([]);
              setSelectedCard(null);
              onClose();
            }}
            className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
