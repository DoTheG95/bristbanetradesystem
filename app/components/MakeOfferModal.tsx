'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DraftTradeItem } from '@/lib/tradetypes';

interface MatchedCard {
  tcgplayer_id: string;
  tcgplayer_name: string;
  card_number: string | null;
  qty: number | null;
  price: number | null;
}

// Extend DraftTradeItem locally to carry counter_price
interface RequestDraft extends DraftTradeItem {
  counter_price: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  receiverId: string;
  receiverName: string;
  theyHaveForMe: MatchedCard[];
}

export default function MakeOfferModal({ open, onClose, receiverId, receiverName, theyHaveForMe }: Props) {
  const [myUserId, setMyUserId]       = useState<string | null>(null);
  const [myTradelist, setMyTradelist] = useState<MatchedCard[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);

  const [requesting, setRequesting]   = useState<RequestDraft[]>([]);
  const [offering, setOffering]       = useState<DraftTradeItem[]>([]);

  const [message, setMessage]         = useState('');
  const [meetDate, setMeetDate]       = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const [myCardSearch, setMyCardSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setMyUserId(session.user.id);
      loadMyTradelist(session.user.id);
    });
    // Pre-select all their cards, pre-filling counter_price with the listed price
    setRequesting(theyHaveForMe.map(c => ({
      ...c,
      offered_by:    'them' as const,
      counter_price: c.price ?? null,
    })));
    setOffering([]);
    setMessage('');
    setMeetDate('');
    setError(null);
  }, [open]);

  const loadMyTradelist = async (uid: string) => {
    setLoadingMine(true);

    const { data, error } = await supabase.rpc('get_my_tradelist', {
      p_user_id: uid,
    });

    if (error) {
      setError(error.message);
      setLoadingMine(false);
      return;
    }

    setMyTradelist((data ?? []).map((c: any) => ({
      tcgplayer_id: c.tcgplayer_id,
      tcgplayer_name: c.tcgplayer_name ?? '',
      card_number: c.card_number ?? null,
      qty: c.qty ?? null,
      price: c.price != null ? parseFloat(c.price) : null,
    })));

    setLoadingMine(false);
  };


  const toggleRequesting = (card: MatchedCard) => {
    setRequesting(prev => {
      const exists = prev.find(c => c.tcgplayer_id === card.tcgplayer_id);
      if (exists) return prev.filter(c => c.tcgplayer_id !== card.tcgplayer_id);
      return [...prev, {
        ...card,
        offered_by:    'them' as const,
        counter_price: card.price ?? null, // pre-fill with seller's listed price
      }];
    });
  };

  const toggleOffering = (card: MatchedCard) => {
    setOffering(prev => {
      const exists = prev.find(c => c.tcgplayer_id === card.tcgplayer_id);
      if (exists) return prev.filter(c => c.tcgplayer_id !== card.tcgplayer_id);
      return [...prev, { ...card, offered_by: 'me' as const }];
    });
  };

  const updateRequestQty = (tcgplayer_id: string, raw: string) => {
    const n = parseInt(raw, 10);
    setRequesting(prev => prev.map(c => {
      if (c.tcgplayer_id !== tcgplayer_id) return c;
      const source = theyHaveForMe.find(s => s.tcgplayer_id === tcgplayer_id);
      const max    = source?.qty ?? null;
      let qty: number | null = isNaN(n) || n < 1 ? null : n;
      if (qty !== null && max !== null && qty > max) qty = max;
      return { ...c, qty };
    }));
  };

  const updateOfferQty = (tcgplayer_id: string, raw: string) => {
    const n = parseInt(raw, 10);
    setOffering(prev => prev.map(c =>
      c.tcgplayer_id === tcgplayer_id ? { ...c, qty: isNaN(n) || n < 1 ? null : n } : c
    ));
  };

  const updateCounterPrice = (tcgplayer_id: string, raw: string) => {
    const n = parseFloat(raw);
    setRequesting(prev => prev.map(c =>
      c.tcgplayer_id === tcgplayer_id
        ? { ...c, counter_price: isNaN(n) || n < 0 ? null : parseFloat(n.toFixed(2)) }
        : c
    ));
  };

const handleSubmit = useCallback(async () => {
  if (!myUserId) return;
  if (requesting.length === 0) {
    setError('Select at least one card to request.');
    return;
  }

  setSubmitting(true);
  setError(null);

  try {
    const items = [
      ...requesting.map(c => ({
        offered_by: receiverId,
        tcgplayer_id: c.tcgplayer_id,
        tcgplayer_name: c.tcgplayer_name,
        card_number: c.card_number,
        qty: c.qty,
        price:
          c.counter_price !== null && c.counter_price !== undefined
            ? c.counter_price
            : c.price ?? null,
      })),
      ...offering.map(c => ({
        offered_by: myUserId,
        tcgplayer_id: c.tcgplayer_id,
        tcgplayer_name: c.tcgplayer_name,
        card_number: c.card_number,
        qty: c.qty,
        price: c.price ?? null,
      })),
    ];

    const { data, error } = await supabase.rpc('create_trade_with_items', {
      p_sender: myUserId,
      p_receiver: receiverId,
      p_meet_date: meetDate || null,
      p_message: message || null,
      p_items: items,
    });
    console.log('RPC Response:', { data, error });
    if (error) console.error('Supabase RPC error:', error);

    if (error) throw error;

    if (!data.success) {
      if (data.error === 'duplicate_request') {
        setError('You already have a pending trade for one or more of these cards.');
      } else {
        setError(data.message || 'Failed to create trade.');
        console.error('Trade creation failed:', data); // Helpful for debugging
      }
      setSubmitting(false);
      return;
    }

    onClose();

  } catch (err: any) {
    setError(err.message ?? 'Something went wrong.');
  } finally {
    setSubmitting(false);
  }
}, [
  myUserId,
  receiverId,
  requesting,
  offering,
  message,
  meetDate,
  onClose
]);


  if (!open) return null;

  const filteredMyTradelist = myTradelist.filter(c =>
    !myCardSearch ||
    c.tcgplayer_name.toLowerCase().includes(myCardSearch.toLowerCase()) ||
    (c.card_number ?? '').toLowerCase().includes(myCardSearch.toLowerCase())
  );

  return (
    <div onClick={onClose} className="ca-modal-overlay">
      <div onClick={e => e.stopPropagation()} className="ca-modal ca-modal--xl ca-modal--max-h">
        {/* Header */}
        <div className="ca-modal-header">
          <div>
            <h2 className="ca-modal-title">Make an Offer</h2>
            <p className="ca-modal-subtitle">to {receiverName}</p>
          </div>
          <button onClick={onClose} className="ca-icon-btn">×</button>
        </div>

        {/* Body */}
        <div className="ca-modal-body">

          {/* Cards I'm requesting */}
          <section>
            <div className="ca-modal-section-label ca-modal-section-label--accent">
              Cards you want from them
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {theyHaveForMe.map(card => {
                const selected = !!requesting.find(c => c.tcgplayer_id === card.tcgplayer_id);
                const draft    = requesting.find(c => c.tcgplayer_id === card.tcgplayer_id);

                return (
                  <div
                    key={card.tcgplayer_id}
                    className={`ca-offer-row${selected ? ' is-selected' : ''}`}
                    onClick={() => toggleRequesting(card)}
                  >
                    <img
                      src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
                      alt={card.tcgplayer_name}
                      className="ca-mini-card-thumb"
                    />

                    <div className="ca-mini-card-info">
                      <div className="ca-mini-card-name">{card.tcgplayer_name}</div>
                      <div className="ca-mini-card-number">{card.card_number}</div>
                    </div>

                    {/* Qty */}
                    {selected && (
                      <input
                        type="number" min={1}
                        max={card.qty ?? undefined}
                        value={draft?.qty ?? ''}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateRequestQty(card.tcgplayer_id, e.target.value)}
                        placeholder={card.qty != null ? `max ${card.qty}` : 'qty'}
                        className="ca-offer-qty-input"
                      />
                    )}

                    {/* Price column */}
                    <div className="ca-offer-price-col">
                      {/* Seller's asking price — always visible */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--ca-text-ghost)' }}>asking</span>
                        <span className={`ca-offer-asking-value${card.price != null ? ' is-set' : ''}`}>
                          {card.price != null ? `$${card.price.toFixed(2)}` : '—'}
                        </span>
                      </div>

                      {/* Counter price input — only when selected */}
                      {selected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--ca-text-ghost)' }}>offer</span>
                          <div style={{ position: 'relative' }}>
                            <span className="ca-counter-dollar-sign">$</span>
                            <input
                              type="number" min={0} step={0.01}
                              value={draft?.counter_price ?? ''}
                              placeholder={card.price != null ? card.price.toFixed(2) : '0.00'}
                              onClick={e => e.stopPropagation()}
                              onChange={e => updateCounterPrice(card.tcgplayer_id, e.target.value)}
                              className="ca-counter-input"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Checkbox */}
                    <div className={`ca-checkbox${selected ? ' is-checked' : ''}`}>
                      {selected && <span className="ca-checkbox-mark">✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Divider */}
          <div className="ca-divider-label">
            <div className="ca-divider" />
            <span>Your offer in return (optional)</span>
            <div className="ca-divider" />
          </div>

          {/* Cards I'm offering */}
          <section>
            <div className="ca-modal-section-label ca-modal-section-label--amber">
              Cards from your trade list
            </div>
            {loadingMine ? (
              <div style={{ fontSize: 12, color: 'var(--ca-text-ghost)', padding: '12px 0' }}>Loading your cards…</div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search your cards…"
                  value={myCardSearch}
                  onChange={e => setMyCardSearch(e.target.value)}
                  className="ca-offer-search-input"
                />
                <div className="ca-offer-list-scroll">
                  {filteredMyTradelist.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--ca-text-shadow)', padding: '8px 0' }}>No cards on your trade list yet.</div>
                  ) : filteredMyTradelist.map(card => {
                    const selected = !!offering.find(c => c.tcgplayer_id === card.tcgplayer_id);
                    const draft    = offering.find(c => c.tcgplayer_id === card.tcgplayer_id);
                    return (
                      <div
                        key={card.tcgplayer_id}
                        className={`ca-offer-row ca-offer-row--amber${selected ? ' is-selected' : ''}`}
                        onClick={() => toggleOffering(card)}
                      >
                        <img
                          src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
                          alt={card.tcgplayer_name}
                          className="ca-mini-card-thumb"
                        />
                        <div className="ca-mini-card-info">
                          <div className="ca-mini-card-name">{card.tcgplayer_name}</div>
                          <div className="ca-mini-card-number">{card.card_number}</div>
                        </div>
                        {card.price != null && (
                          <span className="ca-mini-card-price">
                            ${card.price.toFixed(2)}
                          </span>
                        )}
                        {selected && (
                          <input
                            type="number" min={1}
                            value={draft?.qty ?? ''}
                            onClick={e => e.stopPropagation()}
                            onChange={e => updateOfferQty(card.tcgplayer_id, e.target.value)}
                            placeholder="qty"
                            className="ca-offer-qty-input"
                          />
                        )}
                        <div className={`ca-checkbox${selected ? ' is-checked-amber' : ''}`}>
                          {selected && <span className="ca-checkbox-mark ca-checkbox-mark--dark">✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {/* Message */}
          <section>
            <div className="ca-modal-section-label ca-modal-section-label--muted">Message (optional)</div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Add a note to your offer…"
              maxLength={500}
              rows={3}
              className="ca-textarea"
            />
          </section>

          {/* Meet date */}
          <section>
            <div className="ca-modal-section-label ca-modal-section-label--muted">Proposed meet date (optional)</div>
            <input
              type="date"
              value={meetDate}
              onChange={e => setMeetDate(e.target.value)}
              className="ca-date-input"
            />
          </section>

          {error && (
            <div className="ca-error-box ca-error-box--inline">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ca-modal-footer">
          <span className="ca-footer-text">
            {requesting.length} card{requesting.length !== 1 ? 's' : ''} requested
            {offering.length > 0 ? `, ${offering.length} offered` : ''}
          </span>
          <div className="ca-footer-btn-group">
            <button
              onClick={onClose}
              className="ca-btn ca-btn-ghost ca-btn-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || requesting.length === 0}
              className="ca-btn ca-btn-primary ca-btn-md"
            >
              {submitting ? 'Sending…' : 'Send Offer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
