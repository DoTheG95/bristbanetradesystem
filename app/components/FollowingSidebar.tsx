'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface FollowedUser {
  id: string;
  display_name: string | null;
  digimon: string | null;
}

interface Props {
  userId: string;
}

const COLLAPSE_KEY = 'ca-following-collapsed';

export default function FollowingSidebar({ userId }: Props) {
  const [following, setFollowing] = useState<FollowedUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  // Restore collapsed state after mount (avoids SSR/client hydration mismatch)
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', userId);

      const ids = (rows ?? []).map(r => r.following_id);
      if (ids.length === 0) {
        setFollowing([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, digimon')
        .in('id', ids);

      setFollowing(profiles ?? []);
      setLoading(false);
    };
    load();
  }, [userId]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? following.filter(u => (u.display_name || '').toLowerCase().includes(q))
    : following;

  return (
    <aside className={`ca-following-sidebar${collapsed ? ' is-collapsed' : ''}`}>
      <div className="ca-following-sidebar-header">
        <span className="ca-following-sidebar-header-label">Following</span>
        <button
          onClick={toggleCollapsed}
          className="ca-following-sidebar-toggle"
          title={collapsed ? 'Expand' : 'Minimise'}
          aria-label={collapsed ? 'Expand following list' : 'Minimise following list'}
        >
          {collapsed ? '+' : '−'}
        </button>
      </div>

      {!collapsed && (
        <>
          {following.length > 0 && (
            <div className="ca-search-wrap ca-following-sidebar-search">
              <svg className="ca-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search following…"
                className="ca-input ca-input--search"
              />
              {search && <button onClick={() => setSearch('')} className="ca-search-clear">×</button>}
            </div>
          )}

          {loading ? (
            <div className="ca-following-sidebar-empty">Loading…</div>
          ) : following.length === 0 ? (
            <div className="ca-following-sidebar-empty">You're not following anyone yet.</div>
          ) : filtered.length === 0 ? (
            <div className="ca-following-sidebar-empty">No matches for "{search}"</div>
          ) : (
            <div className="ca-following-sidebar-list">
              {filtered.map(user => (
                <div
                  key={user.id}
                  className="ca-following-sidebar-item"
                  onClick={() => router.push(`/user/${user.id}`)}
                >
                  <div
                    className="ca-avatar ca-avatar--sm"
                    style={{ '--ca-hue': (user.display_name || '?').charCodeAt(0) * 7 % 360 } as React.CSSProperties}
                  >
                    {(user.display_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="ca-following-sidebar-info">
                    <div className="ca-following-sidebar-name">{user.display_name || 'Unknown'}</div>
                    {user.digimon && <div className="ca-following-sidebar-digimon">{user.digimon}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
