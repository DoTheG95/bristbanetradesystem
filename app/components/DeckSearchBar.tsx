'use client';

import React, { useEffect, useRef, useState } from 'react';
import { DeckSearchResult, isDigiEgg } from './DeckTypes';

interface RawCard {
  tcgplayer_id: number | string;
  tcgplayer_name: string;
  id: string;
  type: string;
  rarity: string;
  level: number | null;
}

interface Props {
  onAdd: (card: DeckSearchResult) => void;
  isAdded: (tcgplayerId: string) => boolean;
  canAdd: (card: DeckSearchResult) => boolean;
}

const rarityClass = (rarity: string | null) => rarity ? `ca-rarity-${rarity.toLowerCase()}` : '';

export default function DeckSearchBar({ onAdd, isAdded, canAdd }: Props) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DeckSearchResult[]>([]);
  const [noResults, setNoResults] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search — supports both card number ("BT1-084") and name queries.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;

    const controller = new AbortController();
    const handle = setTimeout(() => {
      setLoading(true);
      setNoResults(false);

      const url = new URL('https://digimoncard.io/api-public/search');
      if (q.includes('-')) url.searchParams.append('card', q);
      else url.searchParams.append('n', q);

      fetch(url.toString(), { signal: controller.signal })
        .then(r => r.json())
        .then((data: RawCard[]) => {
          setLoading(false);
          setIsOpen(true);

          if (!Array.isArray(data) || data.length === 0) {
            setResults([]);
            setNoResults(true);
            return;
          }

          setResults(data.map(c => ({
            tcgplayer_id: String(c.tcgplayer_id),
            tcgplayer_name: c.tcgplayer_name ?? '',
            card_number: c.id ?? '',
            rarity: c.rarity ? String(c.rarity).toUpperCase() : null,
            card_type: c.type ?? null,
            level: c.level ?? null,
          })).filter(c => c.tcgplayer_id && c.tcgplayer_id !== 'undefined'));
        })
        .catch(err => {
          if (err.name !== 'AbortError') console.warn('deck card search failed', err);
          setLoading(false);
          setIsOpen(true);
          setResults([]);
          setNoResults(true);
        });
    }, 300);

    return () => { clearTimeout(handle); controller.abort(); };
  }, [query]);

  const handleResultClick = (card: DeckSearchResult) => {
    if (!canAdd(card)) return;
    onAdd(card);
  };

  return (
    <div ref={wrapperRef} className="ca-searchbar ca-deck-searchbar">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const value = e.target.value;
          setQuery(value);
          if (!value.trim()) { setResults([]); setNoResults(false); }
        }}
        onFocus={() => query.trim().length >= 2 && setIsOpen(true)}
        placeholder="Search card name or number…"
        className="ca-searchbar-input"
      />

      {isOpen && (
        <div className="ca-searchbar-dropdown ca-deck-searchbar-dropdown">
          {loading && (
            <div className="ca-searchbar-note">Searching...</div>
          )}

          {!loading && noResults && (
            <div className="ca-searchbar-note">No results found</div>
          )}

          {!loading && results.map((card) => {
            const added = isAdded(card.tcgplayer_id);
            const full = !canAdd(card);
            const egg = isDigiEgg(card.card_type);
            return (
              <div
                key={card.tcgplayer_id}
                onClick={() => handleResultClick(card)}
                className={`ca-deck-searchbar-item${full ? ' is-disabled' : ''}`}
              >
                <img
                  src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
                  alt={card.tcgplayer_name}
                  className="ca-deck-searchbar-thumb"
                />
                <div className="ca-deck-searchbar-info">
                  <span className="ca-searchbar-card-name">{card.tcgplayer_name}</span>
                  <span className="ca-searchbar-card-meta">
                    {card.card_number}
                    {card.rarity && <> · <span className={rarityClass(card.rarity)}>{card.rarity}</span></>}
                    {egg ? ' · Digi-Egg' : ''}
                  </span>
                </div>
                <span className={`ca-deck-searchbar-flag${added ? ' is-added' : ''}${full ? ' is-full' : ''}`}>
                  {full ? 'Full' : '+'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
