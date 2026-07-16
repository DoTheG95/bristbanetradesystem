'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import SearchModal from '../components/SearchModal';
import MakeOfferModal from '../components/MakeOfferModal';
import MarkSoldModal from '../components/MarkSoldModal';
import MatchModal, { MatchResult, MatchedCard } from '../components/MatchModal';
import { supabase } from '@/lib/supabase';
import Navbar from '../components/Navbar';
import {
  AUTO_SAVE_DELAY,
  CardEntry,
  EMPTY_LISTS,
  ListType,
  PER_PAGE_OPTIONS,
  PopoverState,
  RARITY_ORDER,
  SORT_LABELS,
  SortDir,
  SortField,
  TraderGroup,
  TraderResult,
} from '../components/CardTypes';
import ViewToggle from '../components/ViewToggle';
import ListView from '../components/ListView';

export default function MainPage() {
  const [userId, setUserId]           = useState<string | null>(null);
  const [checking, setChecking]       = useState(true);
  const [activeTab, setActiveTab]     = useState<ListType>('wishlist');
  const [lists, setLists]             = useState<Record<ListType, CardEntry[]>>(EMPTY_LISTS);
  const [showModal, setShowModal]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState<string | null>(null);
  const [loading, setLoading]         = useState<Record<ListType, boolean>>({ wishlist: false, tradelist: false });
  const [popover, setPopover]         = useState<PopoverState | null>(null);
  const popoverRef                    = useRef<HTMLDivElement>(null);
  const autoSaveTimer                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyTabs                     = useRef<Set<ListType>>(new Set());

  const [tableSearch, setTableSearch] = useState('');
  const [sortField, setSortField]     = useState<SortField>('date_added');
  const [sortDir, setSortDir]         = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selected, setSelected]       = useState<Set<string>>(new Set());

  // Match Me (full wishlist)
  const [showMatchScopeModal, setShowMatchScopeModal] = useState(false);
  const [matchResults, setMatchResults]               = useState<MatchResult[] | null>(null);
  const [showMatchResults, setShowMatchResults]       = useState(false);

  // Find traders (specific cards)
  const [findLoading, setFindLoading]     = useState(false);
  const [traderGroups, setTraderGroups]   = useState<TraderGroup[] | null>(null);
  const [findCardLabel, setFindCardLabel] = useState<string>('');

  const [offerTarget, setOfferTarget] = useState<MatchResult | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Mark as sold (rendered once here, not per-row, so it can't fight the hover-popover state in the list)
  const [soldTarget, setSoldTarget] = useState<CardEntry | null>(null);

  /* ── auth guard ── */
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
        .from('user_cards').select('*').eq('user_id', userId).eq('list_type', activeTab);
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
  }, [activeTab, checking, userId]);

  useEffect(() => { setCurrentPage(1); setSelected(new Set()); }, [activeTab, tableSearch, sortField, sortDir]);

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
            quantity: c.quantity, rarity: c.rarity, price: c.price,
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

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleMatchResults = useCallback((results: MatchResult[]) => {
    setMatchResults(results);
    setShowMatchResults(true);
  }, []);

  /* ── Find traders for specific cards ── */
  const findTraders = useCallback(async (tcgIds: string[], label: string) => {
    if (!userId) return;
    setFindLoading(true);
    setTraderGroups(null);
    setFindCardLabel(label);

    const { data, error } = await supabase.rpc('find_traders_for_cards', {
      p_tcgplayer_ids: tcgIds,
      p_user_id:       userId,
    });

    setFindLoading(false);

    if (error) { console.error('find_traders_for_cards error:', error); return; }

    // Group rows by trader
    const groupMap: Record<string, TraderGroup> = {};
    for (const row of (data ?? []) as TraderResult[]) {
      if (!groupMap[row.user_id]) {
        groupMap[row.user_id] = {
          userId:      row.user_id,
          displayName: row.display_name,
          digimon:     row.digimon ?? null,
          cards:       [],
        };
      }
      groupMap[row.user_id].cards.push({
        tcgplayer_id:   row.tcgplayer_id,
        tcgplayer_name: row.tcgplayer_name,
        card_number:    row.card_number ?? null,
        rarity:         row.rarity ?? null,
        qty:            row.they_have_qty ?? null,
        price:          row.price != null ? parseFloat(String(row.price)) : null,
      });
    }

    setTraderGroups(Object.values(groupMap));
  }, [userId]);

  const handleFindSingle = useCallback((card: CardEntry) => {
    findTraders([card.tcgplayer_id], card.tcgplayer_name);
  }, [findTraders]);

  const handleFindBulk = useCallback(() => {
    const selectedCards = lists['wishlist'].filter(c => selected.has(c.id));
    if (selectedCards.length === 0) return;
    const label = selectedCards.length === 1
      ? selectedCards[0].tcgplayer_name
      : `${selectedCards.length} selected cards`;
    findTraders(selectedCards.map(c => c.tcgplayer_id), label);
  }, [lists, selected, findTraders]);

  /* ── popover handlers ── */
  const handleImageMouseEnter = useCallback((e: React.MouseEvent<HTMLImageElement>, card: CardEntry) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({ cardId: card.id, src: `https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_800x800.jpg`, name: card.card_number, x: rect.right + 12, y: rect.top + rect.height / 2 });
  }, []);
  const handleImageMouseLeave = useCallback(() => setPopover(null), []);

  /* ── add cards ── */
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
          id: crypto.randomUUID(), tcgplayer_id,
          tcgplayer_name: item.tcgplayer_name ?? '',
          card_number: item.card_number ?? item.raw?.id ?? '',
          quantity: item.quantity ?? null,
          rarity: item.raw?.rarity ?? item.rarity ?? null,
          created_at: new Date().toISOString(),
          price: item.price ?? null,
        });
      }
      const updated = { ...prev, [activeTab]: next };
      triggerAutoSave(activeTab, updated);
      return updated;
    });
    setShowModal(false);
  }, [activeTab, triggerAutoSave]);

  const removeCard = useCallback((tab: ListType, id: string) => {
    setLists(prev => {
      const updated = { ...prev, [tab]: prev[tab].filter(c => c.id !== id) };
      triggerAutoSave(tab, updated);
      return updated;
    });
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, [triggerAutoSave]);

  const bulkRemove = useCallback(() => {
    setLists(prev => {
      const updated = { ...prev, [activeTab]: prev[activeTab].filter(c => !selected.has(c.id)) };
      triggerAutoSave(activeTab, updated);
      return updated;
    });
    setSelected(new Set());
  }, [activeTab, selected, triggerAutoSave]);

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

  const handleSoldConfirm = useCallback((soldQty: number) => {
    if (!soldTarget) return;
    const remaining = (soldTarget.quantity ?? soldQty) - soldQty;
    if (remaining > 0) updateQty('tradelist', soldTarget.id, String(remaining));
    else removeCard('tradelist', soldTarget.id);
  }, [soldTarget, updateQty, removeCard]);

  if (checking || !userId) return null;

  const cards     = lists[activeTab];
  const isLoading = loading[activeTab];
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

  const pageIds         = pageCards.map(c => c.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const somePagePartial = pageIds.some(id => selected.has(id)) && !allPageSelected;
  const someSelected    = selected.size > 0;

  const toggleSelectAll = () => {
    if (allPageSelected) setSelected(prev => { const n = new Set(prev); pageIds.forEach(id => n.delete(id)); return n; });
    else setSelected(prev => { const n = new Set(prev); pageIds.forEach(id => n.add(id)); return n; });
  };
  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

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
            <h1 className="ca-list-title">My Lists</h1>
            <p className="ca-list-subtitle">Track cards you want and cards you're trading away.</p>
          </div>
          <button onClick={() => setShowMatchScopeModal(true)} className="ca-match-btn">
            ⚡ Match me!
          </button>
        </div>

        {/* Tabs + Add */}
        <div className="ca-tabs-row">
          <div className="ca-tabbar">
            {(['wishlist', 'tradelist'] as ListType[]).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setTableSearch(''); }} className={`ca-tab${activeTab === tab ? ' is-active' : ''}`}>
                {tab === 'wishlist' ? '✦ Wishlist' : '⇄ Trade list'}
                {lists[tab].length > 0 && <span className="ca-tab-count">{lists[tab].length}</span>}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(saving || saveMsg) && (
              <span className={`ca-save-indicator${saveMsg?.includes('failed') ? ' is-failed' : saving ? '' : ' is-saved'}`}>
                {saving && <span className="ca-spinner ca-spinner--sm" />}
                {saving ? 'Saving…' : saveMsg}
              </span>
            )}
            <button onClick={() => setShowModal(true)} className="ca-add-cards-btn">
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add cards
            </button>
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

        {/* Bulk action bar */}
        {someSelected && (
          <div className="ca-bulk-bar">
            <span className="ca-bulk-count">{selected.size} selected</span>
            <div className="ca-bulk-spacer" />
            {/* Find selected — wishlist only */}
            {isWishlist && (
              <button onClick={handleFindBulk} className="ca-btn ca-btn-outline-accent ca-btn-sm">
                🔍 Find selected
              </button>
            )}
            <button onClick={bulkRemove} className="ca-btn ca-btn-outline-danger ca-btn-sm">Remove selected</button>
            <button onClick={() => setSelected(new Set())} className="ca-btn ca-btn-ghost ca-btn-sm" style={{ borderColor: 'var(--ca-border-strong)' }}>Clear</button>
          </div>
        )}

        {/* Table */}
        <div className="ca-table-wrap">
          {/* Header */}
          <div className="ca-table-header-row ca-grid-cols-main">
            <div onClick={toggleSelectAll} className={`ca-checkbox${allPageSelected ? ' is-checked' : ''}`}>
              {allPageSelected && <span className="ca-checkbox-mark">✓</span>}
              {somePagePartial && <span className="ca-checkbox-dash">–</span>}
            </div>
            <span />
            <span className="ca-th-label">Card</span>
            <span className="ca-th-label">Rarity</span>
            <span className="ca-th-label">Qty</span>
            <span className="ca-th-label">
              {isWishlist ? 'Find' : 'Price ($)'}
            </span>
            <span />
            <div className="ca-th-actions">
              <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} title="Items per page" className="ca-per-page-select">
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="ca-table-loading">Loading…</div>
          ) : cards.length === 0 ? (
            <div className="ca-table-empty">
              {isWishlist ? 'No cards on your wishlist yet.' : 'No cards on your trade list yet.'}<br />
              <span className="ca-table-empty-hint">Use the + button above to add cards.</span>
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
              toggleSelect={toggleSelect}
              removeCard={removeCard}
              updateQty={updateQty}
              updatePrice={updatePrice}
              handleFindSingle={handleFindSingle}
              handleImageMouseEnter={handleImageMouseEnter}
              handleImageMouseLeave={handleImageMouseLeave}
              requestMarkSold={setSoldTarget}
              viewMode={viewMode}
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
      </div>

      {/* Popover */}
      {popover && (
        <div
          ref={popoverRef}
          className="ca-popover"
          style={{ '--popover-x': `${popover.x}px`, '--popover-y': `${popover.y}px` } as React.CSSProperties}
        >
          <img src={popover.src} alt={popover.name} className="ca-popover-img" />
        </div>
      )}

      {/* Match scope modal */}
      {userId && (
        <MatchModal open={showMatchScopeModal} onClose={() => setShowMatchScopeModal(false)} userId={userId} onResults={handleMatchResults} />
      )}

      {/* ── Find Traders results modal ── */}
      {(findLoading || traderGroups !== null) && (
        <div onClick={() => { setTraderGroups(null); setFindLoading(false); }} className="ca-modal-overlay">
          <div onClick={e => e.stopPropagation()} className="ca-modal ca-modal--md ca-modal--max-h-85">
            {/* Header */}
            <div className="ca-modal-header">
              <div>
                <h2 className="ca-modal-title">🔍 Traders selling this</h2>
                <p className="ca-modal-subtitle" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{findCardLabel}</p>
              </div>
              <button onClick={() => { setTraderGroups(null); setFindLoading(false); }} className="ca-icon-btn">×</button>
            </div>

            {/* Body */}
            <div className="ca-modal-body--plain">
              {findLoading ? (
                <div className="ca-empty-state">
                  <span className="ca-spinner" style={{ width: 24, height: 24, borderWidth: 3, marginBottom: 12 }} />
                  <div style={{ color: 'var(--ca-text-ghost)', fontSize: 13 }}>Searching traders…</div>
                </div>
              ) : traderGroups !== null && traderGroups.length === 0 ? (
                <div className="ca-empty-state">
                  <div className="ca-empty-icon">🃏</div>
                  <div className="ca-empty-title">No traders found.</div>
                  <div className="ca-empty-subtitle">Nobody has listed this card in their trade list yet.</div>
                </div>
              ) : (traderGroups ?? []).map((group) => (
                <div key={group.userId} className="ca-list-item-block">
                  {/* Trader header */}
                  <div className="ca-item-block-header">
                    <div
                      className="ca-avatar ca-avatar--md"
                      style={{ '--ca-hue': (group.userId.charCodeAt(0) * 7) % 360 } as React.CSSProperties}
                    >
                      {group.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="ca-trader-info">
                      <div className="ca-trader-name">{group.displayName}</div>
                      {group.digimon && <div className="ca-trader-digimon">{group.digimon}</div>}
                    </div>
                    {/* Make Offer — convert trader group to MatchResult shape */}
                    <button
                      onClick={() => {
                        setTraderGroups(null);
                        setOfferTarget({
                          userId:       group.userId,
                          displayName:  group.displayName,
                          digimon:      group.digimon,
                          theyHaveForMe: group.cards.map(c => ({
                            tcgplayer_id:   c.tcgplayer_id,
                            tcgplayer_name: c.tcgplayer_name,
                            card_number:    c.card_number ?? '',
                            qty:            c.qty,
                            rarity:         c.rarity,
                            price:          c.price,
                          })),
                          iHaveForThem: [],
                        });
                      }}
                      className="ca-make-offer-btn"
                    >
                      Make Offer
                    </button>
                  </div>

                  {/* Cards this trader has */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {group.cards.map(card => (
                      <div key={card.tcgplayer_id} className="ca-mini-card-row">
                        <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`} alt={card.tcgplayer_name} className="ca-mini-card-thumb" />
                        <div className="ca-mini-card-info">
                          <div className="ca-mini-card-name">{card.tcgplayer_name}</div>
                          <div className="ca-mini-card-number">{card.card_number}</div>
                        </div>
                        {card.rarity && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ca-text-faint)', flexShrink: 0 }}>{card.rarity}</span>}
                        {card.qty != null && <span className="ca-mini-card-qty">×{card.qty}</span>}
                        {card.price != null && (
                          <span className="ca-mini-card-price">${card.price.toFixed(2)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Match results modal */}
      {showMatchResults && matchResults !== null && (
        <div onClick={() => setShowMatchResults(false)} className="ca-modal-overlay" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div onClick={e => e.stopPropagation()} className="ca-modal ca-modal--lg ca-modal--max-h-85">
            <div className="ca-modal-header">
              <div>
                <h2 className="ca-modal-title" style={{ fontSize: 16 }}>Trade Matches</h2>
                <p className="ca-modal-subtitle">{matchResults.length === 0 ? 'No matches found' : `${matchResults.length} trader${matchResults.length !== 1 ? 's' : ''} matched`}</p>
              </div>
              <button onClick={() => setShowMatchResults(false)} className="ca-icon-btn">×</button>
            </div>
            <div className="ca-modal-body--plain">
              {matchResults.length === 0 ? (
                <div className="ca-empty-state">
                  <div className="ca-empty-icon">🃏</div>
                  <div className="ca-empty-title">No traders found.</div>
                </div>
              ) : matchResults.map((result) => {
                const isMutual = result.theyHaveForMe.length > 0 && result.iHaveForThem.length > 0;
                return (
                  <div key={result.userId} className="ca-list-item-block" style={{ padding: '16px 20px' }}>
                    <div className="ca-item-block-header" style={{ marginBottom: 12 }}>
                      <div
                        className="ca-avatar ca-avatar--lg"
                        style={{ '--ca-hue': (result.userId.charCodeAt(0) * 7) % 360 } as React.CSSProperties}
                      >
                        {result.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="ca-trader-info">
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ca-text)' }}>{result.displayName}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          {result.digimon && <span className="ca-trader-digimon">{result.digimon}</span>}
                          {result.distanceKm !== undefined && <span className="ca-distance-badge">📍 {result.distanceKm}km away</span>}
                          {isMutual && <span className="ca-mutual-badge">✦ Mutual</span>}
                        </div>
                      </div>
                      <button onClick={() => { setShowMatchResults(false); setOfferTarget(result); }} className="ca-btn ca-btn-primary ca-btn-md">Make Offer</button>
                    </div>
                    {result.theyHaveForMe.length > 0 && (
                      <div style={{ marginBottom: result.iHaveForThem.length > 0 ? 12 : 0 }}>
                        <div className="ca-match-section-label ca-match-section-label--theirs">In their trade list ↓</div>
                        {result.theyHaveForMe.map(card => (
                          <div key={card.tcgplayer_id} className="ca-mini-card-row" style={{ marginBottom: 3 }}>
                            <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`} alt={card.tcgplayer_name} className="ca-mini-card-thumb" />
                            <div className="ca-mini-card-info">
                              <div className="ca-mini-card-name">{card.tcgplayer_name || '—'}</div>
                              <div className="ca-mini-card-number">{card.card_number}</div>
                            </div>
                            {card.rarity && <span style={{ fontSize: 9, color: 'var(--ca-text-faint)', fontWeight: 700 }}>{card.rarity}</span>}
                            {card.qty != null && <span className="ca-mini-card-qty">×{card.qty}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {result.iHaveForThem.length > 0 && (
                      <div>
                        <div className="ca-match-section-label ca-match-section-label--mine">They're looking for ({result.iHaveForThem.length}) ↓</div>
                        {result.iHaveForThem.map(card => (
                          <div key={card.tcgplayer_id} className="ca-mini-card-row ca-mini-card-row--outlined" style={{ marginBottom: 3 }}>
                            <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`} alt={card.tcgplayer_name} className="ca-mini-card-thumb" />
                            <div className="ca-mini-card-info">
                              <div className="ca-mini-card-name">{card.tcgplayer_name || '—'}</div>
                              <div className="ca-mini-card-number">{card.card_number}</div>
                            </div>
                            {card.rarity && <span style={{ fontSize: 9, color: 'var(--ca-text-faint)', fontWeight: 700 }}>{card.rarity}</span>}
                            {card.qty != null && <span className="ca-mini-card-qty">×{card.qty}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Make Offer Modal */}
      {offerTarget && (
        <MakeOfferModal open={!!offerTarget} onClose={() => setOfferTarget(null)} receiverId={offerTarget.userId} receiverName={offerTarget.displayName} theyHaveForMe={offerTarget.theyHaveForMe} />
      )}

      {/* Mark as sold */}
      {soldTarget && (
        <MarkSoldModal
          open={!!soldTarget}
          cardName={soldTarget.tcgplayer_name}
          maxQty={soldTarget.quantity ?? 1}
          onClose={() => setSoldTarget(null)}
          onConfirm={handleSoldConfirm}
        />
      )}

      <SearchModal open={showModal} onClose={() => setShowModal(false)} onAdd={handleAdd} />
    </div>
  );
}
