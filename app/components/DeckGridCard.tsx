'use client';

import React from 'react';
import { DeckCard } from './DeckTypes';

interface Props {
  card: DeckCard;
  canIncrement: boolean;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function DeckGridCard({ card, canIncrement, onIncrement, onDecrement, onRemove }: Props) {
  return (
    <div className="ca-deck-tile" title={card.tcgplayer_name}>
      <button onClick={() => onRemove(card.id)} className="ca-deck-tile-remove" aria-label={`Remove ${card.tcgplayer_name}`}>×</button>

      <img
        src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_400x400.jpg`}
        alt={card.tcgplayer_name}
        className="ca-deck-tile-image"
      />

      <div className="ca-deck-tile-footer">
        <button onClick={() => onDecrement(card.id)} className="ca-deck-tile-qty-btn">−</button>
        <span className="ca-deck-tile-qty">×{card.quantity}</span>
        <button onClick={() => onIncrement(card.id)} disabled={!canIncrement} className="ca-deck-tile-qty-btn">+</button>
      </div>
    </div>
  );
}
