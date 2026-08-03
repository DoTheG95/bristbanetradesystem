export const MAX_DIGI_EGG = 5;
export const MAX_NON_EGG = 50;

export const DIGI_EGG_TYPE = 'Digi-Egg';

export interface DeckCard {
  id: string;
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string;
  rarity: string | null;
  card_type: string | null;
  level: number | null;
  quantity: number;
}

export interface Deck {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  digiEggCount: number;
  nonEggCount: number;
}

export interface DeckSearchResult {
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string;
  rarity: string | null;
  card_type: string | null;
  level: number | null;
}

export const isDigiEgg = (cardType: string | null) => cardType === DIGI_EGG_TYPE;

// Standard limit on copies of a single card (by card number, so alternate
// arts of the same card share one limit — matches how digimoncard.io counts it).
export const MAX_COPIES_PER_CARD = 4;

// Card numbers that are exempt from the standard 4-copy limit, mapped to
// their own max. Add entries here as needed, e.g. { 'BT1-084': 50 }.
export const CARD_COPY_EXCEPTIONS: Record<string, number> = {};

export const getMaxCopies = (cardNumber: string) => CARD_COPY_EXCEPTIONS[cardNumber] ?? MAX_COPIES_PER_CARD;

// Main-deck sort order: Digimon (by level, then name), then Tamer, then Option.
export const MAIN_DECK_TYPE_ORDER: Record<string, number> = {
  Digimon: 0,
  Tamer: 1,
  Option: 2,
};
