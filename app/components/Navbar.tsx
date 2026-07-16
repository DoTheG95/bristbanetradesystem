'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import NotificationBell from './NotificationBell';
import SearchBar from './SearchBar';
import FollowingSidebar from './FollowingSidebar';
import SideMenu from './SideMenu';

interface Profile {
  display_name: string | null;
  role: string | null;
  digimon: string | null;
}

export default function Navbar() {
  const [profile, setProfile] = useState<Profile>({ display_name: null, role: null, digimon: null });
  const [userId, setUserId]   = useState<string | null>(null);

  useEffect(() => {
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data } = await supabase
          .from('profiles')
          .select('display_name, user_role, digimon')
          .eq('id', session.user.id)
          .single();
        setProfile({
          display_name: data?.display_name || null,
          role:         data?.user_role         || 'user',
          digimon:      data?.digimon      || 'Koromon',
        });
      }
    };
    getProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.replace('/');
  };

  const isAdmin = profile.role === 'admin';

  return (
    <>
    <nav className="ca-navbar">
      <div className="ca-navbar-inner">

        {/* Logo — unassociated with the nav-links section, pinned to the far left */}
        <span className="ca-navbar-logo" onClick={() => window.location.href = '/main'}>
          Cardboard Addiction
        </span>

        {/* Search bar */}
        <SearchBar />

        {/* User section */}
        <div className="ca-navbar-user-group">
          {profile.display_name && (
            <div className="ca-navbar-user-info">
              <span className="ca-navbar-user-name">{profile.display_name}</span>
              <span className={`ca-navbar-role${isAdmin ? ' is-admin' : ''}`}>
                {profile.role ?? 'user'}
              </span>
              <span className="ca-navbar-digimon">{profile.digimon ?? 'Koromon'}</span>
            </div>
          )}

          {/* Notification bell — only shown once userId is known */}
          {userId && <NotificationBell userId={userId} />}

          <button onClick={handleLogout} className="ca-navbar-logout">Logout</button>
        </div>
      </div>
    </nav>
    <SideMenu />
    {userId && <FollowingSidebar userId={userId} />}
    </>
  );
}
