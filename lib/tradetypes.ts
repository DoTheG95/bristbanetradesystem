export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'countered';

export type NotificationType =
  | 'offer_received'
  | 'offer_accepted'
  | 'offer_declined'
  | 'offer_cancelled'
  | 'counter_received'
  | 'message_received';

export interface TradeItem {
  id: string;
  trade_id: string;
  offered_by: string;
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string | null;
  qty: number | null;
}

export interface TradeMessage {
  id: string;
  trade_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  // joined
  sender_display_name?: string;
}

export interface Trade {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: TradeStatus;
  meet_date: string | null;
  created_at: string;
  updated_at: string;
  // joined
  sender_display_name?: string;
  receiver_display_name?: string;
  items?: TradeItem[];
  messages?: TradeMessage[];
}

export interface Notification {
  id: string;
  user_id: string;
  trade_id: string | null;
  type: NotificationType;
  read: boolean;
  created_at: string;
}

// Used when building a new offer before submission
export interface DraftTradeItem {
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string | null;
  qty: number | null;
  offered_by: 'me' | 'them'; // UI only
  price: number | null;
}