import React from 'react';

const RARITY_COLOURS: Record<string, string> = {
  C: '#555',
  U: '#4a7a6a',
  R: '#4f6fa8',
  SR: '#7c5abf',
  UR: '#b8860b',
  SEC: '#c0392b',
  P: '#888',
};

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

export default function SelectedCard({
  item,
  onRemove,
  onIncrementQty,
  onDecrementQty,
  onPriceChange,
}: Props) {
  return (
    <div
      style={{
        background: '#16161c',
        border: '1px solid #24242b',
        borderRadius: 12,
        padding: 14,
        position: 'relative',
      }}
    >
      <button
        onClick={() => onRemove(item.id)}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 24,
          height: 24,
          border: 'none',
          borderRadius: 6,
          background: 'transparent',
          color: '#555',
          cursor: 'pointer',
          fontSize: 14,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#ff5c5c';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#555';
        }}
      >
        ✕
      </button>

      {/* Header */}

      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <img
          src={`https://tcgplayer-cdn.tcgplayer.com/product/${item.tcgplayer_id}_in_200x200.jpg`}
          style={{
            width: 44,
            height: 44,
            objectFit: 'contain',
            borderRadius: 6,
            background: '#1b1b22',
            flexShrink: 0,
          }}
        />

        <div
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: '#e6e6e6',
              fontWeight: 600,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {item.tcgplayer_name}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 5,
              alignItems: 'center',
            }}
          >
            <span
              style={{
                color: '#666',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            >
              {item.card_number}
            </span>

            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: RARITY_COLOURS[item.rarity] ?? '#777',
                border: `1px solid ${RARITY_COLOURS[item.rarity] ?? '#444'}`,
                borderRadius: 999,
                padding: '2px 7px',
              }}
            >
              {item.rarity}
            </span>
          </div>
        </div>
      </div>

      {/* Qty + Price */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        {/* Qty */}

        <div>
          <div
            style={{
              fontSize: 10,
              color: '#666',
              marginBottom: 5,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
            }}
          >
            Qty
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#1d1d24',
              border: '1px solid #2d2d36',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => onDecrementQty(item.id)}
              style={buttonStyle}
            >
              −
            </button>

            <div
              style={{
                flex: 1,
                textAlign: 'center',
                color: '#ddd',
                fontWeight: 600,
              }}
            >
              {item.quantity ?? '—'}
            </div>

            <button
              onClick={() => onIncrementQty(item.id)}
              style={buttonStyle}
            >
              +
            </button>
          </div>
        </div>

        {/* Price */}

        <div>
          <div
            style={{
              fontSize: 10,
              color: '#666',
              marginBottom: 5,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
            }}
          >
            Price
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#1d1d24',
              border: '1px solid #2d2d36',
              borderRadius: 8,
              paddingLeft: 10,
            }}
          >
            <span
              style={{
                color: '#777',
                fontWeight: 600,
              }}
            >
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
                style={{
                    flex: 1,
                    maxWidth: 80,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#eee',
                    padding: '8px',
                    fontSize: 13,
                }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: 'none',
  background: 'transparent',
  color: '#888',
  cursor: 'pointer',
  fontSize: 16,
};