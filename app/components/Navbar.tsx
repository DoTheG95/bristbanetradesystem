'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import NotificationBell from './NotificationBell';
import SearchBar from './SearchBar';
import FollowingSidebar from './FollowingSidebar';
import SideMenu from './SideMenu';
import UnregisterModal from './UnregisterModal';
import { navLinks } from './navLinks';

interface Profile {
  display_name: string | null;
  role: string | null;
  digimon: string | null;
}

export default function Navbar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile>({ display_name: null, role: null, digimon: null });
  const [userId, setUserId]   = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen]     = useState(false);
  const [showUnregister, setShowUnregister]   = useState(false);

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

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileNavOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.replace('/');
  };

  const isAdmin = profile.role === 'admin';

  return (
    <>
    <nav className="ca-navbar">
      <div className="ca-navbar-inner">

        {/* Hamburger — only visible once the fixed side menu hides itself */}
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="ca-navbar-hamburger"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>

        {/* Logo — unassociated with the nav-links section, pinned to the far left */}
        <span className="ca-navbar-logo" onClick={() => window.location.href = '/main'}>
          Cardboard Addiction
        </span>

        {/* Search bar */}
        <SearchBar />

        {/* User section */}
        <div className="ca-navbar-user-group">
          {profile.display_name && (
            <div className="ca-navbar-user-chip">
              <div className="ca-navbar-avatar">{profile.display_name.charAt(0).toUpperCase()}</div>
              <div className="ca-navbar-user-info">
                <span className="ca-navbar-user-name">{profile.display_name}</span>
                {/* <span className={`ca-navbar-role${isAdmin ? ' is-admin' : ''}`}>
                  {profile.role ?? 'user'}
                </span> */}
                <span className="ca-navbar-digimon">{profile.digimon ?? 'Koromon'}</span>
              </div>
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

    {/* Mobile nav drawer — stands in for the fixed side menu on narrow screens */}
    <div
      onClick={() => setMobileNavOpen(false)}
      className={`ca-mobile-nav-overlay${mobileNavOpen ? ' is-open' : ''}`}
    >
      <nav
        onClick={(e) => e.stopPropagation()}
        className={`ca-mobile-nav-drawer${mobileNavOpen ? ' is-open' : ''}`}
      >
        <div className="ca-mobile-nav-header">
          <span className="ca-mobile-nav-title">Menu</span>
          <button onClick={() => setMobileNavOpen(false)} aria-label="Close menu" className="ca-close-x">×</button>
        </div>

        <div className="ca-side-menu-list">
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileNavOpen(false)}
              className={`ca-side-menu-link${pathname === link.href ? ' is-active' : ''}`}
            >
              {link.name}
            </a>
          ))}
        </div>

        <div className="ca-side-menu-footer">
          <button onClick={handleLogout} className="ca-side-menu-link">
            Logout
          </button>
          <button
            onClick={() => { setMobileNavOpen(false); setShowUnregister(true); }}
            className="ca-side-menu-link ca-side-menu-link--danger"
          >
            Delete account
          </button>
        </div>
      </nav>
    </div>

    <UnregisterModal open={showUnregister} onClose={() => setShowUnregister(false)} />
    </>
  );
}
