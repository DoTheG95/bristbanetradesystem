'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '../../components/Navbar';
import {
  CardEntry,
  EMPTY_LISTS,
  ListType,
  PER_PAGE_OPTIONS,
  PopoverState,
  RARITY_ORDER,
  SORT_LABELS,
  SortDir,
  SortField,
} from '../../components/CardTypes';
import ViewToggle from '../../components/ViewToggle';
import ListView from '../../components/ListView';

interface TargetProfile {
  display_name: string | null;
  user_code: string | null;
  digimon: string | null;
}

export default function UserListsPage() {
  const params = useParams();
  const targetUserId = params?.userid as string;

  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [checking, setChecking]             = useState(true);

  const [targetProfile, setTargetProfile] = useState<TargetProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileNotFound, setProfileNotFound] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked]     = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [blockLoading, setBlockLoading]   = useState(false);

  const [activeTab, setActiveTab] = useState<ListType>('wishlist');
  const [lists, setLists]         = useState<Record<ListType, CardEntry[]>>(EMPTY_LISTS);
  const [loading, setLoading]     = useState<Record<ListType, boolean>>({ wishlist: false, tradelist: false });

  const [tableSearch, setTableSearch] = useState('');
  const [sortField, setSortField]     = useState<SortField>('date_added');
  const [sortDir, setSortDir]         = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [viewMode, setViewMode]       = useState<'grid' | 'list'>('grid');

  const [popover, setPopover] = useState<PopoverState | null>(null);

  /* ── auth guard (need logged-in user id to compute readOnly + keep Navbar working) ── */
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        window.location.replace('/');
        return;
      }
      setLoggedInUserId(session.user.id);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        window.location.replace('/');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ── readOnly: true whenever viewing someone other than yourself ── */
  const readOnly = !!loggedInUserId && !!targetUserId && loggedInUserId !== targetUserId;

  /* ── load target user's profile ── */
  useEffect(() => {
    if (checking || !targetUserId) return;
    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileNotFound(false);
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, user_code, digimon')
        .eq('id', targetUserId)
        .single();

      if (error || !data) {
        setProfileNotFound(true);
        setTargetProfile(null);
      } else {
        setTargetProfile(data);
      }
      setProfileLoading(false);
    };
    loadProfile();
  }, [checking, targetUserId]);

  /* ── load follow/block relationship toward the target user ── */
  useEffect(() => {
    if (!readOnly || !loggedInUserId || !targetUserId) return;
    const loadRelationship = async () => {
      const [{ data: followRow }, { data: blockRow }] = await Promise.all([
        supabase.from('user_follows').select('follower_id').eq('follower_id', loggedInUserId).eq('following_id', targetUserId).maybeSingle(),
        supabase.from('user_blocks').select('blocker_id').eq('blocker_id', loggedInUserId).eq('blocked_id', targetUserId).maybeSingle(),
      ]);
      setIsFollowing(!!followRow);
      setIsBlocked(!!blockRow);
    };
    loadRelationship();
  }, [readOnly, loggedInUserId, targetUserId]);

  const toggleFollow = async () => {
    if (!loggedInUserId || !targetUserId || followLoading) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase.from('user_follows').delete().eq('follower_id', loggedInUserId).eq('following_id', targetUserId);
      setIsFollowing(false);
    } else {
      await supabase.from('user_follows').insert({ follower_id: loggedInUserId, following_id: targetUserId });
      setIsFollowing(true);
    }
    setFollowLoading(false);
  };

  const toggleBlock = async () => {
    if (!loggedInUserId || !targetUserId || blockLoading) return;
    setBlockLoading(true);
    if (isBlocked) {
      await supabase.from('user_blocks').delete().eq('blocker_id', loggedInUserId).eq('blocked_id', targetUserId);
      setIsBlocked(false);
    } else {
      await supabase.from('user_blocks').insert({ blocker_id: loggedInUserId, blocked_id: targetUserId });
      setIsBlocked(true);
    }
    setBlockLoading(false);
  };

  /* ── load target user's cards for active tab ── */
  useEffect(() => {
    if (checking || !targetUserId || profileNotFound) return;
    if (lists[activeTab].length > 0) return;

    const loadCards = async () => {
      setLoading(prev => ({ ...prev, [activeTab]: true }));
      const { data, error } = await supabase
        .from('user_cards').select('*').eq('user_id', targetUserId).eq('list_type', activeTab);
      if (error) { console.error('Load error:', error); }
      else {
        setLists(prev => ({
          ...prev,
          [activeTab]: (data ?? []).map(c => ({
            id: c.id, tcgplayer_id: String(c.tcgplayer_id),
            tcgplayer_name: c.tcgplayer_name ?? '', card_number: c.card_number ?? '',
            quantity: c.quantity ?? null, rarity: c.rarity ?? null,
            created_at: c.created_at ?? '', price: c.price ?? null,
          })),
        }));
      }
      setLoading(prev => ({ ...prev, [activeTab]: false }));
    };
    loadCards();
  }, [activeTab, checking, targetUserId, profileNotFound]);

  useEffect(() => { setCurrentPage(1); setSelected(new Set()); }, [activeTab, tableSearch, sortField, sortDir]);

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  /* ── popover (view only, no edits) ── */
  const handleImageMouseEnter = useCallback((e: React.MouseEvent<HTMLImageElement>, card: CardEntry) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({ cardId: card.id, src: `https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_800x800.jpg`, name: card.card_number, x: rect.right + 12, y: rect.top + rect.height / 2 });
  }, []);
  const handleImageMouseLeave = useCallback(() => setPopover(null), []);

  /* ── no-op handlers for row-level actions — never invoked while readOnly, kept only to satisfy ListView's prop types ── */
  const noOpToggleSelect = useCallback((_id: string) => {}, []);
  const noOpRemoveCard   = useCallback((_tab: ListType, _id: string) => {}, []);
  const noOpUpdateQty    = useCallback((_tab: ListType, _id: string, _value: string) => {}, []);
  const noOpUpdatePrice  = useCallback((_tab: ListType, _id: string, _value: string) => {}, []);
  const noOpFindSingle   = useCallback((_card: CardEntry) => {}, []);

  if (checking || !loggedInUserId) return null;

  if (profileLoading) {
    return (
      <div className="ca-page">
        <Navbar />
        <div className="ca-state-message">Loading profile…</div>
      </div>
    );
  }

  if (profileNotFound || !targetProfile) {
    return (
      <div className="ca-page">
        <Navbar />
        <div className="ca-state-message">User not found.</div>
      </div>
    );
  }

  const cards      = lists[activeTab];
  const isLoading  = loading[activeTab];
  const isWishlist = activeTab === 'wishlist';

  const q = tableSearch.trim().toLowerCase();
  const filteredCards = q
    ? cards.filter(c => c.tcgplayer_name.toLowerCase().includes(q) || c.card_number.toLowerCase().includes(q))
    : cards;

  const sortedCards = [...filteredCards].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'date_added': cmp = (a.created_at ?? '') < (b.created_at ?? '') ? -1 : (a.created_at ?? '') > (b.created_at ?? '') ? 1 : 0; break;
      case 'name': cmp = a.tcgplayer_name.localeCompare(b.tcgplayer_name); break;
      case 'rarity': cmp = (RARITY_ORDER[a.rarity ?? ''] ?? -1) - (RARITY_ORDER[b.rarity ?? ''] ?? -1); break;
      case 'card_number': cmp = a.card_number.localeCompare(b.card_number, undefined, { numeric: true }); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sortedCards.length / itemsPerPage));
  const safePage   = Math.min(currentPage, totalPages);
  const pageStart  = (safePage - 1) * itemsPerPage;
  const pageCards  = sortedCards.slice(pageStart, pageStart + itemsPerPage);

  const SortBtn = ({ field }: { field: SortField }) => {
    const active = sortField === field;
    return (
      <button onClick={() => handleSortToggle(field)} className={`ca-sort-btn${active ? ' is-active' : ''}`}>
        {SORT_LABELS[field]}<span className="ca-sort-btn-arrow">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </button>
    );
  };

  return (
    <div className="ca-page">
      <Navbar />

      <div className="ca-container">

        {/* Header */}
        <div className="ca-list-header-row">
          <div>
            <h1 className="ca-list-title">
              {targetProfile.display_name ?? 'Unknown user'}'s Lists
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              {targetProfile.user_code && (
                <span className="ca-card-number">{targetProfile.user_code}</span>
              )}
              {targetProfile.digimon && (
                <>
                  <span className="ca-navbar-sep">|</span>
                  <span style={{ fontSize: 12, color: 'var(--ca-text-faint)' }}>{targetProfile.digimon}</span>
                </>
              )}
            </div>

            {readOnly && (
              <div className="ca-profile-actions">
                <button
                  onClick={toggleFollow}
                  disabled={followLoading}
                  className={`ca-btn ca-btn-sm ${isFollowing ? 'ca-btn-ghost' : 'ca-btn-outline-accent'}`}
                >
                  {isFollowing ? '✓ Following' : '+ Follow'}
                </button>
                <button
                  onClick={toggleBlock}
                  disabled={blockLoading}
                  className={`ca-btn ca-btn-sm ${isBlocked ? 'ca-btn-ghost' : 'ca-btn-outline-danger'}`}
                >
                  {isBlocked ? 'Unblock' : 'Block'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="ca-tabs-row">
          <div className="ca-tabbar">
            {(['wishlist', 'tradelist'] as ListType[]).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setTableSearch(''); }} className={`ca-tab${activeTab === tab ? ' is-active' : ''}`}>
                {tab === 'wishlist' ? '✦ Wishlist' : '⇄ Trade list'}
                {lists[tab].length > 0 && <span className="ca-tab-count">{lists[tab].length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="ca-search-wrap">
          <svg className="ca-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" value={tableSearch} onChange={e => setTableSearch(e.target.value)} placeholder={`Search ${isWishlist ? 'wishlist' : 'trade list'}…`} className="ca-input ca-input--search" />
          {tableSearch && <button onClick={() => setTableSearch('')} className="ca-search-clear">×</button>}
        </div>

        {/* Sort */}
        <div className="ca-sort-row">
          <div className="ca-sort-group">
            <span className="ca-sort-label">Sort</span>
            {(['date_added', 'name', 'rarity', 'card_number'] as SortField[]).map(f => <SortBtn key={f} field={f} />)}
          </div>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {/* Table */}
        <div className="ca-table-wrap">
          {isLoading ? (
            <div className="ca-table-loading">Loading…</div>
          ) : cards.length === 0 ? (
            <div className="ca-table-empty">
              {isWishlist ? 'This user has no cards on their wishlist.' : 'This user has no cards on their trade list.'}
            </div>
          ) : sortedCards.length === 0 ? (
            <div className="ca-table-nomatch">
              No cards match "<span className="ca-table-nomatch-query">{tableSearch}</span>"
            </div>
          ) : (
            <ListView
              cards={pageCards}
              activeTab={activeTab}
              selectedCards={selected}
              toggleSelect={noOpToggleSelect}
              removeCard={noOpRemoveCard}
              updateQty={noOpUpdateQty}
              updatePrice={noOpUpdatePrice}
              handleFindSingle={noOpFindSingle}
              handleImageMouseEnter={handleImageMouseEnter}
              handleImageMouseLeave={handleImageMouseLeave}
              viewMode={viewMode}
              readOnly={readOnly}
            />
          )}
        </div>

        {/* Pagination */}
        {sortedCards.length > 0 && (
          <div className="ca-pagination-row">
            <span className="ca-pagination-count">{sortedCards.length} card{sortedCards.length !== 1 ? 's' : ''}{q ? ` (filtered from ${cards.length})` : ''}</span>
            <div className="ca-pagination-controls">
              <button onClick={() => setCurrentPage(1)} disabled={safePage === 1} className="ca-page-btn">{'|<'}</button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="ca-page-btn">{'<'}</button>
              <span className="ca-page-indicator">{safePage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="ca-page-btn">{'>'}</button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages} className="ca-page-btn">{'>|'}</button>
            </div>
            <span className="ca-pagination-count">{pageStart + 1}–{Math.min(pageStart + itemsPerPage, sortedCards.length)} of {sortedCards.length}</span>
          </div>
        )}

        {/* Items-per-page selector */}
        {sortedCards.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -12, marginBottom: 8 }}>
            <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} title="Items per page" className="ca-per-page-select ca-per-page-select--footer">
              {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Popover */}
      {popover && (
        <div
          className="ca-popover"
          style={{ '--popover-x': `${popover.x}px`, '--popover-y': `${popover.y}px` } as React.CSSProperties}
        >
          <img src={popover.src} alt={popover.name} className="ca-popover-img" />
        </div>
      )}
    </div>
  );
}
