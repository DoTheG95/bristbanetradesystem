'use client';

import React from 'react';

export type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ViewToggle({
  viewMode,
  onChange,
}: ViewToggleProps) {
  const buttonStyle = (
    active: boolean
  ): React.CSSProperties => ({
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    background: active ? "#4f46e5" : "transparent",
    boxShadow: active
    ? "0 0 18px rgba(79,70,229,.35)"
    : "none",
    color: active ? "#fff" : "#666",
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: '#111115',
        border: '1px solid #1e1e24',
        boxShadow: '0 4px 16px rgba(0,0,0,.25)',
        borderRadius: 10,
        padding: 4,
        gap: 4,
      }}
    >
      <button
        title="Grid View"
        onClick={() => onChange('grid')}
        style={buttonStyle(viewMode === 'grid')}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>

      <button
        title="List View"
        onClick={() => onChange('list')}
        style={buttonStyle(viewMode === 'list')}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <rect x="4" y="5" width="16" height="2" rx="1" />
          <rect x="4" y="11" width="16" height="2" rx="1" />
          <rect x="4" y="17" width="16" height="2" rx="1" />
        </svg>
      </button>
    </div>
  );
}