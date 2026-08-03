'use client';

import React, { useState } from 'react';
import {
  CardRowProps,
} from './CardTypes';

const rarityClass = (rarity: string | null) => rarity ? `ca-rarity-${rarity.toLowerCase()}` : '';

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

      <div className="ca-row-image-wrap">
        <img
          src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
          alt={card.tcgplayer_name}
          onMouseEnter={(e) =>
            handleImageMouseEnter(e, card)
          }
          onMouseLeave={handleImageMouseLeave}
          className="ca-row-image"
        />
      </div>

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
            <span className={`ca-row-rarity-pill ${rarityClass(card.rarity)}`}>
              {card.rarity}
            </span>
          )}
        </div>
      </div>

      {/* Qty + wishlist/trade field — a single grid cell on desktop (via display:contents)
          that becomes a compact side-by-side row on mobile. */}
      <div className="ca-row-fields">

        {/* Qty */}
        <div className="ca-row-qty">
          <div className="ca-row-field-label">
            Quantity
          </div>

          {readOnly ? (
            <div className="ca-row-value-box">
              ×{card.quantity ?? '—'}
            </div>
          ) : (
            <div className="ca-row-qty-field">
              <span className="ca-row-qty-sign">×</span>
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
                className="ca-row-qty-input"
              />
            </div>
          )}
        </div>

        {/* Wishlist / Trade — the wishlist "Find Trader" button only shows here on
            desktop; on mobile it moves into ca-row-mobile-actions below. */}
        <div className="ca-row-wishtrade">
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
      </div>

      {/* Actions — hidden in read-only mode. On desktop this is its own column;
          on mobile it's replaced by ca-row-mobile-actions below. */}
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

      {/* Mobile-only action row — sits below number/rarity/qty/price, hidden on desktop */}
      {!readOnly && (
        <div className="ca-row-mobile-actions">
          {isWishlist ? (
            <button
              onClick={() => handleFindSingle(card)}
              className="ca-icon-btn"
              title="Find Trader"
            >
              🔍 Find
            </button>
          ) : (
            <button
              onClick={handleMarkSoldClick}
              className="ca-icon-btn"
              title="Mark as sold"
            >
              $ Sold
            </button>
          )}
          <button
            onClick={handleRemoveClick}
            className="ca-icon-btn ca-row-mobile-danger"
            title="Remove"
          >
            × Remove
          </button>
        </div>
      )}
    </div>
  );
}
