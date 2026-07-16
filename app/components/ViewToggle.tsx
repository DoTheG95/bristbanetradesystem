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
  return (
    <div className="ca-view-toggle">
      <button
        title="Grid View"
        onClick={() => onChange('grid')}
        className={`ca-view-toggle-btn${viewMode === 'grid' ? ' is-active' : ''}`}
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
        className={`ca-view-toggle-btn${viewMode === 'list' ? ' is-active' : ''}`}
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
