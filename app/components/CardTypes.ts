export type ListType = 'wishlist' | 'tradelist';

export type SortField =
  | 'date_added'
  | 'name'
  | 'rarity'
  | 'card_number';

export type SortDir = 'asc' | 'desc';

export interface CardEntry {
  id: string;
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string;
  quantity: number | null;
  rarity: string | null;
  created_at?: string;
  price: number | null;
}

export interface PopoverState {
  cardId: string;
  src: string;
  name: string;
  x: number;
  y: number;
}

export interface TraderResult {
  user_id: string;
  display_name: string;
  digimon: string | null;
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string | null;
  rarity: string | null;
  they_have_qty: number | null;
  price: number | null;
}

export interface TraderGroup {
  userId: string;
  displayName: string;
  digimon: string |null;
  cards: {
    tcgplayer_id: string;
    tcgplayer_name: string;
    card_number: string | null;
    rarity: string | null;
    qty: number | null;
    price: number | null;
  }[];
}

export const EMPTY_LISTS: Record<ListType, CardEntry[]> = {
  wishlist: [],
  tradelist: [],
};

export const PER_PAGE_OPTIONS = [5, 10, 20, 50, 100];

export const AUTO_SAVE_DELAY = 1500;

export const RARITY_ORDER: Record<string, number> = {
  C: 0,
  U: 1,
  UC: 1,
  R: 2,
  SR: 3,
  UR: 4,
  SEC: 5,
  P: 6,
};

export const SORT_LABELS: Record<SortField, string> = {
  date_added: 'Date added',
  name: 'Name',
  rarity: 'Rarity',
  card_number: 'Card no.',
};

import React from 'react';

export interface CardRowProps {
  card: CardEntry;
  activeTab: ListType;

  selected: boolean;

  toggleSelect: (id: string) => void;

  removeCard: (
    tab: ListType,
    id: string
  ) => void;

  updateQty: (
    tab: ListType,
    id: string,
    value: string
  ) => void;

  updatePrice: (
    tab: ListType,
    id: string,
    value: string
  ) => void;

  handleFindSingle: (
    card: CardEntry
  ) => void;

  handleImageMouseEnter: (
    e: React.MouseEvent<HTMLImageElement>,
    card: CardEntry
  ) => void;

  handleImageMouseLeave: () => void;

  /** Tradelist items with qty > 1 route through this instead of removeCard directly, so the parent (rendered once, not per-row) can show a quantity-sold modal. */
  requestMarkSold?: (card: CardEntry) => void;

  /** When true, hides checkbox, remove button, and disables qty/price/find editing (read-only view of another user's lists) */
  readOnly?: boolean;
}