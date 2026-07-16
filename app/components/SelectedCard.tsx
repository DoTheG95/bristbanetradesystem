import React from 'react';

type SelectedItem = {
  id: string;
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string;
  rarity: string;
  quantity: number | null;
  price: number | null;
};

interface Props {
  item: SelectedItem;
  onRemove: (id: string) => void;
  onIncrementQty: (id: string) => void;
  onDecrementQty: (id: string) => void;
  onPriceChange: (id: string, value: string) => void;
}

const rarityClass = (rarity: string) => rarity ? `ca-rarity-${rarity.toLowerCase()}` : '';

export default function SelectedCard({
  item,
  onRemove,
  onIncrementQty,
  onDecrementQty,
  onPriceChange,
}: Props) {
  return (
    <div className="ca-selected-card">
      <button
        onClick={() => onRemove(item.id)}
        className="ca-selected-card-remove"
      >
        ✕
      </button>

      {/* Header */}

      <div className="ca-selected-card-header">
        <img
          src={`https://tcgplayer-cdn.tcgplayer.com/product/${item.tcgplayer_id}_in_200x200.jpg`}
          className="ca-selected-card-thumb"
        />

        <div className="ca-selected-card-info">
          <div className="ca-selected-card-name">
            {item.tcgplayer_name}
          </div>

          <div className="ca-selected-card-meta">
            <span className="ca-selected-card-number">
              {item.card_number}
            </span>

            <span className={`ca-badge-rarity ${rarityClass(item.rarity)}`}>
              {item.rarity}
            </span>
          </div>
        </div>
      </div>

      {/* Qty + Price */}

      <div className="ca-selected-card-grid">
        {/* Qty */}

        <div>
          <div className="ca-selected-field-label">
            Qty
          </div>

          <div className="ca-qty-stepper">
            <button
              onClick={() => onDecrementQty(item.id)}
              className="ca-qty-stepper-btn"
            >
              −
            </button>

            <div className="ca-qty-stepper-value">
              {item.quantity ?? '—'}
            </div>

            <button
              onClick={() => onIncrementQty(item.id)}
              className="ca-qty-stepper-btn"
            >
              +
            </button>
          </div>
        </div>

        {/* Price */}

        <div>
          <div className="ca-selected-field-label">
            Price
          </div>

          <div className="ca-price-stepper">
            <span className="ca-price-sign">
              $
            </span>

            <input
                type="text"
                inputMode="decimal"
                value={item.price ?? ''}
                onChange={(e) =>
                    onPriceChange(item.id, e.target.value)
                }
                placeholder="0.00"
                className="ca-price-input-plain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
