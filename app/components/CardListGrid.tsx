'use client';

import React from 'react';
import { CardRowProps } from './CardTypes';

const formatPrice = (value: any) => {
  const num = Number(value);
  if (value === null || value === undefined || value === '' || isNaN(num)) {
    return '';
  }
  return num.toFixed(2);
};

export default function CardGridRow({
  card,
  activeTab,
  selected,
  toggleSelect,
  removeCard,
  updateQty,
  updatePrice,
  handleFindSingle,
  handleImageMouseEnter,
  handleImageMouseLeave,
}: CardRowProps) {
  const isWishlist = activeTab === 'wishlist';

  return (
    <div
      className={`
        group relative bg-[#111115] border rounded-2xl p-3
        transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5
        ${selected
          ? 'border-indigo-500 bg-[#18182a] shadow-md shadow-indigo-500/20'
          : 'border-[#1e1e24] hover:border-[#2a2a32]'
        }
      `}
    >
      {/* Select Checkbox */}
      <div
        onClick={() => toggleSelect(card.id)}
        className={`
          absolute top-3 right-3 w-5 h-5 rounded-lg border-2 cursor-pointer
          flex items-center justify-center transition-all
          ${selected
            ? 'bg-indigo-600 border-indigo-600'
            : 'border-gray-600 group-hover:border-gray-400'
          }
        `}
      >
        {selected && (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* IMAGE (expanded priority) */}
      <div className="aspect-[4/3] mb-3 bg-black/40 rounded-xl overflow-hidden">
        <img
          src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
          alt={card.tcgplayer_name}
          className="w-full h-full object-contain p-1.5 transition-transform group-hover:scale-105"
          onMouseEnter={(e) => handleImageMouseEnter(e, card)}
          onMouseLeave={handleImageMouseLeave}
        />
      </div>

      {/* Meta (reduced emphasis) */}
      <div className="text-white text-sm font-medium line-clamp-1 mb-1">
        {card.tcgplayer_name}
      </div>

      <div className="text-[11px] text-gray-500 mb-2">
        #{card.card_number}
      </div>

      {/* Controls */}
      <div className="space-y-2">
        {/* Qty + Price row (50/50 split) */}
        <div className="grid grid-cols-2 gap-2">
          <input
            value={card.quantity ?? ''}
            onChange={(e) => updateQty(activeTab, card.id, e.target.value)}
            placeholder="Qty"
            className="w-full bg-[#0e0e12] border border-[#1e1e24] focus:border-indigo-500 rounded-xl px-2.5 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none"
          />

          {isWishlist ? (
            <button
              onClick={() => handleFindSingle(card)}
              className="w-full border border-indigo-500 hover:bg-indigo-500/10 text-indigo-400 text-sm font-medium rounded-xl px-2.5 py-2 transition-all active:scale-[0.985]"
            >
              Find
            </button>
          ) : (
            <input
              type="number"
              step="0.01"
              value={card.price ?? ''}
              onChange={(e) =>
                updatePrice(
                  activeTab,
                  card.id,
                  e.target.value
                )
              }
              style={{
                width: '100%',
                padding: '8px',
                background:
                  '#132013',
                border:
                  '1px solid #234323',
                borderRadius: 8,
                color: '#4ade80',
                fontWeight: 600,
              }}
              placeholder='$--.--'
            />
          )}
        </div>

        {/* Remove */}
        <button
          onClick={() => removeCard(activeTab, card.id)}
          className="w-full py-2 text-xs text-gray-400 hover:text-red-400 border border-transparent hover:border-red-500/30 hover:bg-red-500/5 rounded-xl transition-all active:scale-[0.985]"
        >
          Mark as Sold
        </button>
      </div>
    </div>
  );
}