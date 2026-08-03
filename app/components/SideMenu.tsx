'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import UnregisterModal from './UnregisterModal';
import { navLinks } from './navLinks';

export default function SideMenu() {
  const pathname = usePathname();
  const [showUnregister, setShowUnregister] = useState(false);

  return (
    <nav className="ca-side-menu">
      <div className="ca-side-menu-list">
        {navLinks.map(link => {
          const isActive = pathname === link.href;
          return (
            <a
              key={link.href}
              href={link.href}
              className={`ca-side-menu-link${isActive ? ' is-active' : ''}`}
            >
              {link.name}
            </a>
          );
        })}
      </div>

      <div className="ca-side-menu-footer">
        <button onClick={() => setShowUnregister(true)} className="ca-side-menu-link ca-side-menu-link--danger">
          Delete account
        </button>
      </div>

      <UnregisterModal open={showUnregister} onClose={() => setShowUnregister(false)} />
    </nav>
  );
}
