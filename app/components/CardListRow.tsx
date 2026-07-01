'use client';

import React from 'react';
import {
  CardRowProps,
} from './CardTypes';

export default function CardListRow({
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
      style={{
        display: 'grid',
        gridTemplateColumns:
          '34px 90px minmax(0,1fr) 110px 120px 44px',
        gap: 18,
        alignItems: 'center',
        padding: '14px 18px',
        borderRadius: 12,
        margin: '10px 12px',
        background: selected
          ? '#18182a'
          : '#141418',
        border: `1px solid ${
          selected
            ? '#4f46e5'
            : '#1e1e24'
        }`,
        transition: '.18s',
      }}
    >
      {/* Checkbox */}

      <div
        onClick={() => toggleSelect(card.id)}
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          cursor: 'pointer',
          border: `2px solid ${
            selected
              ? '#4f46e5'
              : '#34343f'
          }`,
          background: selected
            ? '#4f46e5'
            : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {selected && '✓'}
      </div>

      {/* Image */}

      <img
        src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
        alt={card.tcgplayer_name}
        onMouseEnter={(e) =>
          handleImageMouseEnter(e, card)
        }
        onMouseLeave={handleImageMouseLeave}
        style={{
          width: 72,
          height: 96,
          objectFit: 'contain',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      />

      {/* Information */}

      <div
        style={{
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: 15,
            color: '#ececec',
            marginBottom: 6,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {card.tcgplayer_name}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              color: '#777',
              fontSize: 12,
              fontFamily: 'monospace',
            }}
          >
            {card.card_number}
          </span>

          {card.rarity && (
            <span
              style={{
                padding:
                  '3px 8px',
                borderRadius: 999,
                background:
                  '#202030',
                color: '#9fa8ff',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {card.rarity}
            </span>
          )}
        </div>
      </div>

      {/* Qty */}

      <div>
        <div
          style={{
            fontSize: 11,
            color: '#666',
            marginBottom: 5,
          }}
        >
          Quantity
        </div>

        <input
          type="number"
          min={1}
          value={card.quantity ?? ''}
          onChange={(e) =>
            updateQty(
              activeTab,
              card.id,
              e.target.value
            )
          }
          style={{
            width: '100%',
            padding: '8px',
            background: '#18181e',
            border:
              '1px solid #2b2b36',
            borderRadius: 8,
            color: 'white',
            textAlign: 'center',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* Wishlist / Trade */}

      <div>
        {isWishlist ? (
          <button
            onClick={() =>
              handleFindSingle(card)
            }
            style={{
              width: '100%',
              padding:
                '9px 12px',
              borderRadius: 8,
              border:
                '1px solid #4f46e5',
              background:
                'transparent',
              color: '#818cf8',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔍 Find Trader
          </button>
        ) : (
          <>
            <div
              style={{
                fontSize: 11,
                color: '#666',
                marginBottom: 5,
              }}
            >
              Price
            </div>

            <input
              type="number"
              placeholder='$--.--'
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
            />
          </>
        )}
      </div>

      {/* Delete */}

      <button
        onClick={() =>
          removeCard(
            activeTab,
            card.id
          )
        }
        style={{
          width: 38,
          height: 38,
          borderRadius: 8,
          border:
            '1px solid #2a2a32',
          background:
            'transparent',
          color: '#777',
          cursor: 'pointer',
          fontSize: 18,
        }}
      >
        ×
      </button>
    </div>
  );
}