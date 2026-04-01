'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import NotificationBell from './NotificationBell';

interface Profile {
  display_name: string | null;
  role: string | null;
  digimon: string | null;
}

export default function Navbar() {
  const [profile, setProfile] = useState<Profile>({ display_name: null, role: null, digimon: null });
  const [userId, setUserId]   = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data } = await supabase
          .from('profiles')
          .select('display_name, role, digimon')
          .eq('id', session.user.id)
          .single();
        setProfile({
          display_name: data?.display_name || null,
          role:         data?.role         || 'user',
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

  const navLinks = [
    { name: 'My Lists', href: '/main' },
    { name: 'Posts',    href: '/postpage' },
    { name: 'Locals',   href: '/localarea' },
  ];

  const linkStyle = (isActive: boolean) => ({
    fontSize: 13,
    fontWeight: 500,
    textDecoration: 'none',
    color: isActive ? '#4f46e5' : '#888',
    transition: 'color 0.2s ease',
    padding: '4px 8px',
  });

  const isAdmin = profile.role === 'admin';

  return (
    <nav style={{ borderBottom: '1px solid #1e1e24', background: '#0c0c0e', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo + Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: '#e8e6e0', cursor: 'pointer' }} onClick={() => window.location.href = '/main'}>
            Cardboard Addiction
          </span>
          <div style={{ display: 'flex', gap: 16 }}>
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <a key={link.href} href={link.href} style={linkStyle(isActive)}
                  onMouseEnter={(e) => !isActive && (e.currentTarget.style.color = '#ccc')}
                  onMouseLeave={(e) => !isActive && (e.currentTarget.style.color = '#888')}
                >{link.name}</a>
              );
            })}
          </div>
        </div>

        {/* User section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {profile.display_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{profile.display_name}</span>
              <span style={{ fontSize: 12, color: '#2a2a32', margin: '0 8px' }}>|</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: isAdmin ? '#f59e0b' : '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {profile.role ?? 'user'}
              </span>
              <span style={{ fontSize: 12, color: '#2a2a32', margin: '0 8px' }}>|</span>
              <span style={{ fontSize: 12, color: '#4f46e5', fontWeight: 500 }}>{profile.digimon ?? 'Koromon'}</span>
            </div>
          )}

          {/* Notification bell — only shown once userId is known */}
          {userId && <NotificationBell userId={userId} />}

          <button
            onClick={handleLogout}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid #2a2a32', background: 'transparent', color: '#888', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#eee'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a32'; e.currentTarget.style.color = '#888'; }}
          >Logout</button>
        </div>
      </div>
    </nav>
  );
}