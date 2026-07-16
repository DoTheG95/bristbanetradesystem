'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

const navLinks = [
  { name: 'My Lists', href: '/main' },
  { name: 'Posts',    href: '/postpage' },
  { name: 'Locals',   href: '/localarea' },
];

export default function SideMenu() {
  const pathname = usePathname();

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
    </nav>
  );
}
