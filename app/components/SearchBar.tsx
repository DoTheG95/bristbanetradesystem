'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface UserResult {
  id: string;
  display_name: string | null;
  user_code: string;
  digimon: string | null;
}

interface CardResult {
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string;
  rarity: string | null;
}

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [cardResult, setCardResult] = useState<CardResult | null>(null);
  const [noResults, setNoResults] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    const q = query.trim();

    if (!q) {
      setUserResults([]);
      setCardResult(null);
      setNoResults(false);
      return;
    }

    const controller = new AbortController();
    const handle = setTimeout(() => {
      if (q.includes('-')) {
        searchCard(q, controller);
      } else {
        searchUsers(q);
      }
    }, 300);

    return () => { clearTimeout(handle); controller.abort(); };
  }, [query]);

    const searchUsers = async (value: string) => {
        setLoading(true);
        setCardResult(null);
        setNoResults(false);

        const { data, error } = await supabase.rpc('search_users', { search_query: value });

        setLoading(false);
        setIsOpen(true);

        if (error || !data || data.length === 0) {
        setUserResults([]);
        setNoResults(true);
        return;
        }

        setUserResults(data);
    };

  const searchCard = (value: string, controller: AbortController) => {
    setLoading(true);
    setUserResults([]);
    setNoResults(false);

    const url = new URL('https://digimoncard.io/api-public/search');
    url.searchParams.append('card', value);

    fetch(url.toString(), { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        setLoading(false);
        setIsOpen(true);

        if (!Array.isArray(data) || data.length === 0) {
          setCardResult(null);
          setNoResults(true);
          return;
        }

        const c = data[0];
        setCardResult({
          tcgplayer_id: c.tcgplayer_id ? String(c.tcgplayer_id) : String(c.id ?? ''),
          tcgplayer_name: c.tcgplayer_name ?? '',
          card_number: c.id ?? c.card_number ?? c.cardNumber ?? value,
          rarity: c.rarity ? String(c.rarity).toUpperCase() : null,
        });
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.warn('card search failed', err);
        setLoading(false);
        setIsOpen(true);
        setCardResult(null);
        setNoResults(true);
      });
  };

  const handleUserClick = (user: UserResult) => {
    setIsOpen(false);
    setQuery('');
    router.push(`/user/${user.id}`);
  };

  const handleCardClick = (card: CardResult) => {
    setIsOpen(false);
    setQuery('');
    router.push(`/card/${encodeURIComponent(card.card_number)}`);
  };

  return (
    <div ref={wrapperRef} className="ca-searchbar">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setIsOpen(true)}
        placeholder="Search user code or card number..."
        className="ca-searchbar-input"
      />

      {isOpen && (
        <div className="ca-searchbar-dropdown">
          {loading && (
            <div className="ca-searchbar-note">Searching...</div>
          )}

          {!loading && noResults && (
            <div className="ca-searchbar-note">No results found</div>
          )}

          {!loading && userResults.map((user) => (
            <div
              key={user.id}
              onClick={() => handleUserClick(user)}
              className="ca-searchbar-item"
            >
              <span className="ca-searchbar-item-name">
                {user.display_name || 'Unknown'}
              </span>
              <span className="ca-searchbar-item-code">{user.user_code}</span>
            </div>
          ))}

          {!loading && cardResult && (
            <div
              onClick={() => handleCardClick(cardResult)}
              className="ca-searchbar-card-item"
            >
              <span className="ca-searchbar-card-name">{cardResult.tcgplayer_name}</span>
              <span className="ca-searchbar-card-meta">
                {cardResult.card_number}
                {cardResult.rarity ? ` · ${cardResult.rarity}` : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
