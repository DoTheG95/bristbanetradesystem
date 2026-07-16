'use client';

import React, { useState } from 'react';
import { CardRowProps } from './CardTypes';

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
  requestMarkSold,
  readOnly = false,
}: CardRowProps) {
  const isWishlist = activeTab === 'wishlist';
  const [priceFocused, setPriceFocused] = useState(false);
  const [priceDraft, setPriceDraft]     = useState('');

  const handleMarkSoldClick = () => requestMarkSold?.(card);
  const handleRemoveClick = () => removeCard(activeTab, card.id);

  return (
    <div className={`ca-grid-card${selected ? ' is-selected' : ''}`}>
      {/* Select Checkbox — hidden in read-only mode */}
      {!readOnly && (
        <div
          onClick={() => toggleSelect(card.id)}
          className={`ca-grid-checkbox${selected ? ' is-selected' : ''}`}
        >
          {selected && (
            <svg xmlns="http://www.w3.org/2000/svg" className="ca-grid-checkbox-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}

      {/* IMAGE (expanded priority) */}
      <div className="ca-grid-image-wrap">
        <img
          src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
          alt={card.tcgplayer_name}
          className="ca-grid-image"
          onMouseEnter={(e) => handleImageMouseEnter(e, card)}
          onMouseLeave={handleImageMouseLeave}
        />
      </div>

      {/* Meta (reduced emphasis) */}
      <div className="ca-grid-name">
        {card.tcgplayer_name}
      </div>

      <div className="ca-grid-number">
        #{card.card_number}
      </div>

      {/* Controls */}
      <div className="ca-grid-controls">
        {/* Qty + Price row (50/50 split) */}
        <div className="ca-grid-row-2">
          {readOnly ? (
            <div className="ca-grid-value-box">
              {card.quantity ?? '—'}
            </div>
          ) : (
            <input
              value={card.quantity ?? ''}
              onChange={(e) => updateQty(activeTab, card.id, e.target.value)}
              placeholder="Qty"
              className="ca-grid-input"
            />
          )}

          {isWishlist ? (
            !readOnly && (
              <button
                onClick={() => handleFindSingle(card)}
                className="ca-grid-find-btn"
              >
                Find
              </button>
            )
          ) : readOnly ? (
            <div className="ca-grid-price-box">
              {card.price != null ? `$${card.price.toFixed(2)}` : '$--.--'}
            </div>
          ) : (
            <div className="ca-grid-price-field">
              <span className="ca-grid-price-sign">$</span>
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
                className="ca-grid-price-input"
              />
            </div>
          )}
        </div>

        {/* Actions — hidden in read-only mode */}
        {!readOnly && (
          isWishlist ? (
            <button
              onClick={handleRemoveClick}
              className="ca-grid-remove-btn"
            >
              Remove
            </button>
          ) : (
            <div className="ca-grid-actions-row">
              <button onClick={handleMarkSoldClick} className="ca-grid-sold-btn">Mark as Sold</button>
              <button onClick={handleRemoveClick} className="ca-grid-remove-btn">Remove</button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
