'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

type Scope = 'everyone' | 'communities' | 'nearby';

export interface MatchedCard {
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string | null;
  qty: number | null;
  rarity: string | null;
  price: number | null;
}

export interface MatchResult {
  userId: string;
  displayName: string;
  digimon: string | null;
  theyHaveForMe: MatchedCard[];
  iHaveForThem: MatchedCard[];
  distanceKm?: number;
}

interface Community {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  /** Callback with results so parent can show them */
  onResults: (results: MatchResult[]) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const NEARBY_KM = 100;

/** Haversine distance in km between two lat/lng pairs */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dl  = ((lng2 - lng1) * Math.PI) / 180;
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchModal({ open, onClose, userId, onResults }: Props) {
  const [scope, setScope]                   = useState<Scope>('everyone');
  const [communities, setCommunities]       = useState<Community[]>([]);
  const [selectedComms, setSelectedComms]   = useState<Set<string>>(new Set());
  const [loadingComms, setLoadingComms]     = useState(false);
  const [geoStatus, setGeoStatus]           = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [userLat, setUserLat]               = useState<number | null>(null);
  const [userLng, setUserLng]               = useState<number | null>(null);
  const [searching, setSearching]           = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  // Load user's communities when scope switches to 'communities'
  useEffect(() => {
    if (scope !== 'communities' || communities.length > 0) return;
    setLoadingComms(true);
    supabase
      .from('user_communities')
      .select('community_id, communities(id, name)')
      .eq('user_id', userId)
      .then(({ data }) => {
        const comms: Community[] = (data ?? []).map((r: any) => ({
          id:   String(r.communities?.id ?? r.community_id),
          name: r.communities?.name ?? 'Unknown',
        }));
        setCommunities(comms);
        // Default: all selected
        setSelectedComms(new Set(comms.map(c => c.id)));
        setLoadingComms(false);
      });
  }, [scope, communities.length, userId]);

  // Request geolocation when scope switches to 'nearby'
  useEffect(() => {
    if (scope !== 'nearby') return;
    if (userLat !== null) return; // already have it
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        setGeoStatus('ok');
        // Persist to profile so future sessions and other users can match against us
        await supabase.from('profiles').update({ latitude: lat, longitude: lng }).eq('id', userId);
      },
      () => setGeoStatus('error'),
      { timeout: 10000 }
    );
  }, [scope, userId, userLat]);

  const toggleComm = (id: string) => {
    setSelectedComms(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAllComms  = () => {
    // If all comms are already selected, this will just unselect them, which is fine
    if (selectedComms.size == communities.length) deselectAllComms();
    else (setSelectedComms(new Set(communities.map(c => c.id))));
  };
  const deselectAllComms = () => setSelectedComms(new Set());

  // ── Core match query ──────────────────────────────────────────────────────

  const runMatch = useCallback(async () => {
    setSearching(true);
    setError(null);

    try {
      // 1. Load my own lists (both directions needed)
      const [wishRes, tradeRes] = await Promise.all([
        supabase.from('user_cards').select('tcgplayer_id, tcgplayer_name, card_number, quantity, rarity, price').eq('user_id', userId).eq('list_type', 'wishlist'),
        supabase.from('user_cards').select('tcgplayer_id, tcgplayer_name, card_number, quantity, rarity, price').eq('user_id', userId).eq('list_type', 'tradelist'),
      ]);

      const myWishlist  = wishRes.data  ?? [];
      const myTradelist = tradeRes.data ?? [];
      const myWishIds   = myWishlist.map(c => String(c.tcgplayer_id));
      const myTradeIds  = myTradelist.map(c => String(c.tcgplayer_id));

      if (myWishIds.length === 0 && myTradeIds.length === 0) {
        onResults([]);
        onClose();
        return;
      }

      // 2. Determine candidate user IDs based on scope
      let candidateIds: string[] | null = null; // null = everyone

      if (scope === 'communities') {
        if (selectedComms.size === 0) { setError('Select at least one community.'); setSearching(false); return; }
        const { data: members } = await supabase
          .from('user_communities')
          .select('user_id')
          .in('community_id', Array.from(selectedComms));
        candidateIds = Array.from(new Set((members ?? []).map((m: any) => m.user_id))).filter(id => id !== userId);
      }

      if (scope === 'nearby') {
        if (userLat === null || userLng === null) { setError('Location not available.'); setSearching(false); return; }
        // Fetch all profiles with location set, filter by distance client-side
        const { data: located } = await supabase
          .from('profiles')
          .select('id, latitude, longitude')
          .not('latitude', 'is', null)
          .neq('id', userId);
        candidateIds = (located ?? [])
          .filter(p => p.latitude != null && p.longitude != null && haversineKm(userLat, userLng, p.latitude, p.longitude) <= NEARBY_KM)
          .map(p => p.id);
      }

      // 3. Parallel queries: who has my wishlist cards in their tradelist, and who wants my tradelist cards
      let theyHaveQ = supabase
        .from('user_cards')
        .select('user_id, tcgplayer_id, tcgplayer_name, card_number, quantity, rarity, price')
        .eq('list_type', 'tradelist')
        .neq('user_id', userId);

      let theyWantQ = supabase
        .from('user_cards')
        .select('user_id, tcgplayer_id, tcgplayer_name, card_number, quantity, rarity')
        .eq('list_type', 'wishlist')
        .neq('user_id', userId);

      if (myWishIds.length > 0)  theyHaveQ = theyHaveQ.in('tcgplayer_id', myWishIds);
      else { /* skip — no wishlist items */ }

      if (myTradeIds.length > 0) theyWantQ = theyWantQ.in('tcgplayer_id', myTradeIds);
      else { /* skip */ }

      if (candidateIds !== null) {
        if (candidateIds.length === 0) { onResults([]); onClose(); return; }
        theyHaveQ = theyHaveQ.in('user_id', candidateIds);
        theyWantQ = theyWantQ.in('user_id', candidateIds);
      }

      const [haveRes, wantRes] = await Promise.all([
        myWishIds.length  > 0 ? theyHaveQ : Promise.resolve({ data: [] }),
        myTradeIds.length > 0 ? theyWantQ : Promise.resolve({ data: [] }),
      ]);

      const theyHave = (haveRes.data ?? []) as any[];
      const theyWant = (wantRes.data ?? []) as any[];

      const allUids = Array.from(new Set([...theyHave.map(r => r.user_id), ...theyWant.map(r => r.user_id)]));
      if (allUids.length === 0) { onResults([]); onClose(); return; }

      // 4. Fetch profiles (display_name, digimon, lat/lng for distance)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, digimon, latitude, longitude')
        .in('id', allUids);

      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

      // 5. Build results map
      const map: Record<string, MatchResult> = {};
      for (const uid of allUids) {
        const p = profileMap[uid];
        const dist = (scope === 'nearby' && userLat !== null && userLng !== null && p?.latitude && p?.longitude)
          ? Math.round(haversineKm(userLat, userLng, p.latitude, p.longitude))
          : undefined;
        map[uid] = {
          userId:       uid,
          displayName:  p?.display_name ?? 'Unknown',
          digimon:      p?.digimon ?? null,
          theyHaveForMe: [],
          iHaveForThem:  [],
          distanceKm:   dist,
        };
      }

      for (const row of theyHave) {
        map[row.user_id]?.theyHaveForMe.push({
          tcgplayer_id:   String(row.tcgplayer_id),
          tcgplayer_name: row.tcgplayer_name ?? '',
          card_number:    row.card_number ?? '',
          qty:            row.quantity ?? null,
          rarity:         row.rarity ?? null,
          price: row.price != null ? parseFloat(row.price) : null,
        });
      }
      for (const row of theyWant) {
        map[row.user_id]?.iHaveForThem.push({
          tcgplayer_id:   String(row.tcgplayer_id),
          tcgplayer_name: row.tcgplayer_name ?? '',
          card_number:    row.card_number ?? '',
          qty:            row.quantity ?? null,
          rarity:         row.rarity ?? null,
          price:         row.price ?? null,
        });
      }

      // 6. Sort: mutual first, then total matches, then distance
      const sorted = Object.values(map).sort((a, b) => {
        const aScore = a.theyHaveForMe.length + a.iHaveForThem.length + (a.theyHaveForMe.length > 0 && a.iHaveForThem.length > 0 ? 10 : 0);
        const bScore = b.theyHaveForMe.length + b.iHaveForThem.length + (b.theyHaveForMe.length > 0 && b.iHaveForThem.length > 0 ? 10 : 0);
        if (bScore !== aScore) return bScore - aScore;
        if (a.distanceKm !== undefined && b.distanceKm !== undefined) return a.distanceKm - b.distanceKm;
        return 0;
      });

      onResults(sorted);
      onClose();
    } catch (err: any) {
      console.error('Match error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSearching(false);
    }
  }, [scope, userId, selectedComms, userLat, userLng, onResults, onClose]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!open) return null;

  const canSearch =
    (scope === 'everyone') ||
    (scope === 'communities' && selectedComms.size > 0 && !loadingComms) ||
    (scope === 'nearby' && geoStatus === 'ok');

  const SCOPE_OPTIONS: { id: Scope; label: string; icon: string; desc: string }[] = [
    { id: 'everyone',    label: 'Everyone',      icon: '🌐', desc: 'Search all traders on the platform' },
    { id: 'communities', label: 'My Communities', icon: '🏘️', desc: 'Search traders in your communities' },
    { id: 'nearby',      label: 'Nearby',         icon: '📍', desc: `Within ${NEARBY_KM}km of your location` },
  ];

  return (
    <div
      onClick={handleClose}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: '#111115', border: '1px solid #1e1e24', borderRadius: 14, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', animation: 'matchScopeIn 0.18s ease', fontFamily: "'DM Sans','Segoe UI',sans-serif" }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #1e1e24', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#e8e6e0' }}>⚡ Match me!</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#555' }}>Choose who to search for trade matches</p>
          </div>
          <button onClick={handleClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #2a2a32', background: 'transparent', color: '#555', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Scope selector */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SCOPE_OPTIONS.map(opt => {
            const active = scope === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => { setScope(opt.id); setError(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  border: `1.5px solid ${active ? '#4f46e5' : '#1e1e24'}`,
                  background: active ? '#16182a' : '#16161c',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = '#2a2a3a'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = '#1e1e24'; }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{opt.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#e8e6e0' : '#888' }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: '#444', marginTop: 1 }}>{opt.desc}</div>
                </div>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${active ? '#4f46e5' : '#2a2a32'}`, background: active ? '#4f46e5' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Communities multiselect */}
        {scope === 'communities' && (
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{ background: '#0e0e12', border: '1px solid #1e1e24', borderRadius: 10, overflow: 'hidden' }}>
              {/* Select all row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #1e1e24' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {loadingComms ? 'Loading…' : `${selectedComms.size} of ${communities.length} selected`}
                </span>
                {!loadingComms && communities.length > 0 && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={selectAllComms}   style={{ fontSize: 11, color: '#4f46e5', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>Select all</button>
                    <button onClick={deselectAllComms} style={{ fontSize: 11, color: '#444',    background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>Clear</button>
                  </div>
                )}
              </div>

              {/* Community list */}
              {loadingComms ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#444', fontSize: 12 }}>Loading communities…</div>
              ) : communities.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#333', fontSize: 12 }}>You haven't joined any communities yet.</div>
              ) : (
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {communities.map(c => {
                    const checked = selectedComms.has(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleComm(c.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid #18181e', cursor: 'pointer', background: checked ? '#16182a' : 'transparent', transition: 'background 0.1s' }}
                        onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#141418'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = checked ? '#16182a' : 'transparent'; }}
                      >
                        <div style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${checked ? '#4f46e5' : '#2a2a32'}`, background: checked ? '#4f46e5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {checked && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 13, color: checked ? '#e8e6e0' : '#888', fontWeight: checked ? 500 : 400 }}>{c.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Nearby geo status */}
        {scope === 'nearby' && (
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{ padding: '12px 14px', background: '#0e0e12', border: '1px solid #1e1e24', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              {geoStatus === 'loading' && (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #2a2a32', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#555' }}>Getting your location…</span>
                </>
              )}
              {geoStatus === 'ok' && (
                <>
                  <span style={{ fontSize: 16 }}>📍</span>
                  <div>
                    <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>Location found</div>
                    <div style={{ fontSize: 11, color: '#444', marginTop: 1 }}>Searching within {NEARBY_KM}km of your position</div>
                  </div>
                </>
              )}
              {geoStatus === 'error' && (
                <>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>Location unavailable</div>
                    <div style={{ fontSize: 11, color: '#444', marginTop: 1 }}>Allow location access in your browser and try again</div>
                  </div>
                </>
              )}
              {geoStatus === 'idle' && (
                <span style={{ fontSize: 12, color: '#444' }}>Requesting location…</span>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ margin: '0 20px 12px', padding: '9px 12px', background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 8, fontSize: 12, color: '#c0392b' }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #1e1e24', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={handleClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #2a2a32', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={runMatch}
            disabled={!canSearch || searching}
            style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: !canSearch || searching ? '#1e1e28' : '#4f46e5', color: !canSearch || searching ? '#444' : '#fff', fontSize: 13, fontWeight: 600, cursor: !canSearch || searching ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}
          >
            {searching
              ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #444', borderTopColor: '#888', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Searching…</>
              : '⚡ Find Matches'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes matchScopeIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}