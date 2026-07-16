'use client';

import React, { useState } from 'react';
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
  requestMarkSold,
  readOnly = false,
}: CardRowProps) {
  const isWishlist = activeTab === 'wishlist';
  const [priceFocused, setPriceFocused] = useState(false);
  const [priceDraft, setPriceDraft]     = useState('');

  const handleMarkSoldClick = () => requestMarkSold?.(card);
  const handleRemoveClick = () => removeCard(activeTab, card.id);

  return (
    <div
      className={`ca-row-card ${readOnly ? 'ca-row-grid-cols-readonly' : 'ca-row-grid-cols-full'}${selected ? ' is-selected' : ''}`}
    >
      {/* Checkbox — hidden in read-only mode */}
      {!readOnly && (
        <div
          onClick={() => toggleSelect(card.id)}
          className={`ca-row-checkbox${selected ? ' is-selected' : ''}`}
        >
          {selected && '✓'}
        </div>
      )}

      {/* Image */}

      <img
        src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
        alt={card.tcgplayer_name}
        onMouseEnter={(e) =>
          handleImageMouseEnter(e, card)
        }
        onMouseLeave={handleImageMouseLeave}
        className="ca-row-image"
      />

      {/* Information */}

      <div className="ca-row-info">
        <div className="ca-row-title">
          {card.tcgplayer_name}
        </div>

        <div className="ca-row-meta">
          <span className="ca-row-number">
            {card.card_number}
          </span>

          {card.rarity && (
            <span className="ca-row-rarity-pill">
              {card.rarity}
            </span>
          )}
        </div>
      </div>

      {/* Qty */}

      <div>
        <div className="ca-row-field-label">
          Quantity
        </div>

        {readOnly ? (
          <div className="ca-row-value-box">
            {card.quantity ?? '—'}
          </div>
        ) : (
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
            className="ca-row-input"
          />
        )}
      </div>

      {/* Wishlist / Trade */}

      <div>
        {isWishlist ? (
          !readOnly && (
            <button
              onClick={() =>
                handleFindSingle(card)
              }
              className="ca-row-find-btn"
            >
              🔍 Find Trader
            </button>
          )
        ) : (
          <>
            <div className="ca-row-field-label">
              Price
            </div>

            {readOnly ? (
              <div className="ca-row-price-box">
                {card.price != null ? `$${card.price.toFixed(2)}` : '$--.--'}
              </div>
            ) : (
              <div className="ca-row-price-field">
                <span className="ca-row-price-sign">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="--.--"
                  value={priceFocused ? priceDraft : (card.price != null ? card.price.toFixed(2) : '')}
                  onFocus={() => { setPriceFocused(true); setPriceDraft(card.price != null ? String(card.price) : ''); }}
                  onBlur={() => setPriceFocused(false)}
                  onChange={(e) => {
                    setPriceDraft(e.target.value);
                    updatePrice(
                      activeTab,
                      card.id,
                      e.target.value
                    );
                  }}
                  className="ca-row-price-input"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions — hidden in read-only mode */}
      {!readOnly && (
        <div className="ca-row-actions">
          {!isWishlist && (
            <button
              onClick={handleMarkSoldClick}
              className="ca-row-sold-btn"
              title="Mark as sold"
            >
              $
            </button>
          )}
          <button
            onClick={handleRemoveClick}
            className="ca-row-delete-btn"
            title="Remove"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
