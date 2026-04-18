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

  const [requesting, setRequesting]   = useState<DraftTradeItem[]>([]);
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
    setRequesting(theyHaveForMe.map(c => ({ ...c, offered_by: 'them', counter_price: null })));
    setOffering([]);
    setMessage('');
    setMeetDate('');
    setError(null);
  }, [open]);

  const loadMyTradelist = async (uid: string) => {
    setLoadingMine(true);
    const { data } = await supabase
      .from('user_cards')
      .select('tcgplayer_id, tcgplayer_name, card_number, quantity, price')
      .eq('user_id', uid)
      .eq('list_type', 'tradelist');
    setMyTradelist((data ?? []).map(c => ({
      tcgplayer_id:   String(c.tcgplayer_id),
      tcgplayer_name: c.tcgplayer_name ?? '',
      card_number:    c.card_number ?? null,
      qty:            c.quantity ?? null,
      price:          c.price ?? null,
    })));
    setLoadingMine(false);
  };

  const toggleRequesting = (card: MatchedCard) => {
    setRequesting(prev => {
      const exists = prev.find(c => c.tcgplayer_id === card.tcgplayer_id);
      if (exists) return prev.filter(c => c.tcgplayer_id !== card.tcgplayer_id);
      return [...prev, { ...card, offered_by: 'them', counter_price: null }];
    });
  };

  const toggleOffering = (card: MatchedCard) => {
    setOffering(prev => {
      const exists = prev.find(c => c.tcgplayer_id === card.tcgplayer_id);
      if (exists) return prev.filter(c => c.tcgplayer_id !== card.tcgplayer_id);
      return [...prev, { ...card, offered_by: 'me' }];
    });
  };

  const updateRequestQty = (tcgplayer_id: string, raw: string) => {
    const n = parseInt(raw, 10);
    setRequesting(prev => prev.map(c =>
      c.tcgplayer_id === tcgplayer_id ? { ...c, qty: isNaN(n) || n < 1 ? null : n } : c
    ));
  };

  const updateOfferQty = (tcgplayer_id: string, raw: string) => {
    const n = parseInt(raw, 10);
    setOffering(prev => prev.map(c =>
      c.tcgplayer_id === tcgplayer_id ? { ...c, qty: isNaN(n) || n < 1 ? null : n } : c
    ));
  };

  // Counter price the buyer proposes instead of the seller's asking price
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
    if (requesting.length === 0) { setError('Select at least one card to request.'); return; }

    for (const req of requesting) {
      if (req.qty == null) continue;
      const source = theyHaveForMe.find(c => c.tcgplayer_id === req.tcgplayer_id);
      if (source && source.qty != null && req.qty > source.qty) {
        setError(`You can only request up to ${source.qty}× ${source.tcgplayer_name}.`);
        return;
      }
    }

    for (const off of offering) {
      if (off.qty == null) continue;
      const source = myTradelist.find(c => c.tcgplayer_id === off.tcgplayer_id);
      if (source && source.qty != null && off.qty > source.qty) {
        setError(`You only have ${source.qty}× ${off.tcgplayer_name} to offer.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: trade, error: tradeErr } = await supabase
        .from('trades')
        .insert({
          sender_id:   myUserId,
          receiver_id: receiverId,
          status:      'pending',
          meet_date:   meetDate || null,
        })
        .select('id')
        .single();
      if (tradeErr) throw tradeErr;

      const tradeId = trade.id;

      const items = [
        ...requesting.map(c => ({
          trade_id:       tradeId,
          offered_by:     receiverId,
          tcgplayer_id:   c.tcgplayer_id,
          tcgplayer_name: c.tcgplayer_name,
          card_number:    c.card_number,
          qty:            c.qty,
          // Store the seller's asking price and buyer's counter (if any)
          price:          (c as any).counter_price ?? c.price ?? null,
        })),
        ...offering.map(c => ({
          trade_id:       tradeId,
          offered_by:     myUserId,
          tcgplayer_id:   c.tcgplayer_id,
          tcgplayer_name: c.tcgplayer_name,
          card_number:    c.card_number,
          qty:            c.qty,
          price:          c.price ?? null,
        })),
      ];

      const { error: itemsErr } = await supabase.from('trade_items').insert(items);
      if (itemsErr) throw itemsErr;

      if (message.trim()) {
        const { error: msgErr } = await supabase.from('trade_messages').insert({
          trade_id:  tradeId,
          sender_id: myUserId,
          message:   message.trim(),
        });
        if (msgErr) throw msgErr;
      }

      await supabase.from('notifications').insert({
        user_id:  receiverId,
        trade_id: tradeId,
        type:     'offer_received',
      });

      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [myUserId, receiverId, requesting, offering, message, meetDate, onClose]);

  if (!open) return null;

  const filteredMyTradelist = myTradelist.filter(c =>
    !myCardSearch ||
    c.tcgplayer_name.toLowerCase().includes(myCardSearch.toLowerCase()) ||
    (c.card_number ?? '').toLowerCase().includes(myCardSearch.toLowerCase())
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640, maxHeight: '90vh',
          background: '#111115', border: '1px solid #1e1e24', borderRadius: 14,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          animation: 'modalIn 0.18s ease',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #1e1e24', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#e8e6e0' }}>Make an Offer</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#555' }}>to {receiverName}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #2a2a32', background: 'transparent', color: '#555', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Cards I'm requesting */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Cards you want from them
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {theyHaveForMe.map(card => {
                const selected     = !!requesting.find(c => c.tcgplayer_id === card.tcgplayer_id);
                const draft        = requesting.find(c => c.tcgplayer_id === card.tcgplayer_id);
                const counterPrice = (draft as any)?.counter_price ?? null;

                return (
                  <div
                    key={card.tcgplayer_id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                      background: selected ? '#16182a' : '#16161c',
                      border: `1px solid ${selected ? '#4f46e5' : '#1e1e24'}`,
                      borderRadius: 7, cursor: 'pointer', transition: 'all 0.12s',
                    }}
                    onClick={() => toggleRequesting(card)}
                  >
                    {/* Card image */}
                    <img
                      src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
                      alt={card.tcgplayer_name}
                      style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }}
                    />

                    {/* Card name + number */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.tcgplayer_name}</div>
                      <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>{card.card_number}</div>
                    </div>

                    {/* Qty input when selected */}
                    {selected && (
                      <input
                        type="number" min={1}
                        value={draft?.qty ?? ''}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateRequestQty(card.tcgplayer_id, e.target.value)}
                        placeholder="qty"
                        style={{ width: 48, padding: '3px 6px', background: '#1e1e28', border: '1px solid #3a3a50', borderRadius: 5, color: '#d4d2cc', fontSize: 12, textAlign: 'center', outline: 'none', flexShrink: 0 }}
                      />
                    )}

                    {/* Asking price + counter offer */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                      {/* Seller's asking price */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: '#444' }}>asking</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: card.price != null ? '#4ade80' : '#333' }}>
                          {card.price != null ? `$${card.price.toFixed(2)}` : '—'}
                        </span>
                      </div>
                      {/* Counter price input — only shown when row is selected */}
                      {selected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 10, color: '#444' }}>counter</span>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#f59e0b', pointerEvents: 'none' }}>$</span>
                            <input
                              type="number" min={0} step={0.01}
                              value={counterPrice ?? ''}
                              placeholder="—"
                              onClick={e => e.stopPropagation()}
                              onChange={e => updateCounterPrice(card.tcgplayer_id, e.target.value)}
                              style={{ width: 64, padding: '3px 5px 3px 14px', background: '#1a1810', border: '1px solid #50401a', borderRadius: 5, color: '#f59e0b', fontSize: 12, outline: 'none' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Checkbox */}
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${selected ? '#4f46e5' : '#2a2a32'}`, background: selected ? '#4f46e5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selected && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: '#1e1e24' }} />
            <span style={{ fontSize: 11, color: '#333', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your offer in return (optional)</span>
            <div style={{ flex: 1, height: 1, background: '#1e1e24' }} />
          </div>

          {/* Cards I'm offering */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Cards from your trade list
            </div>
            {loadingMine ? (
              <div style={{ fontSize: 12, color: '#444', padding: '12px 0' }}>Loading your cards…</div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search your cards…"
                  value={myCardSearch}
                  onChange={e => setMyCardSearch(e.target.value)}
                  style={{ width: '100%', marginBottom: 8, padding: '6px 10px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 7, color: '#d4d2cc', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                  {filteredMyTradelist.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#333', padding: '8px 0' }}>No cards on your trade list yet.</div>
                  ) : filteredMyTradelist.map(card => {
                    const selected = !!offering.find(c => c.tcgplayer_id === card.tcgplayer_id);
                    const draft    = offering.find(c => c.tcgplayer_id === card.tcgplayer_id);
                    return (
                      <div
                        key={card.tcgplayer_id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                          background: selected ? '#1a1810' : '#16161c',
                          border: `1px solid ${selected ? '#f59e0b' : '#1e1e24'}`,
                          borderRadius: 7, cursor: 'pointer', transition: 'all 0.12s',
                        }}
                        onClick={() => toggleOffering(card)}
                      >
                        <img
                          src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
                          alt={card.tcgplayer_name}
                          style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.tcgplayer_name}</div>
                          <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>{card.card_number}</div>
                        </div>
                        {/* Show your asking price */}
                        {card.price != null && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', flexShrink: 0 }}>
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
                            style={{ width: 52, padding: '3px 6px', background: '#1e1e18', border: '1px solid #50401a', borderRadius: 5, color: '#d4d2cc', fontSize: 12, textAlign: 'center', outline: 'none' }}
                          />
                        )}
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${selected ? '#f59e0b' : '#2a2a32'}`, background: selected ? '#f59e0b' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {selected && <span style={{ color: '#000', fontSize: 10, lineHeight: 1 }}>✓</span>}
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
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Message (optional)</div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Add a note to your offer…"
              maxLength={500}
              rows={3}
              style={{ width: '100%', padding: '8px 10px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 7, color: '#d4d2cc', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </section>

          {/* Meet date */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Proposed meet date (optional)</div>
            <input
              type="date"
              value={meetDate}
              onChange={e => setMeetDate(e.target.value)}
              style={{ padding: '6px 10px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 7, color: '#d4d2cc', fontSize: 13, outline: 'none', colorScheme: 'dark' }}
            />
          </section>

          {error && (
            <div style={{ fontSize: 12, color: '#c0392b', padding: '8px 12px', background: '#1a0a0a', borderRadius: 7, border: '1px solid #3a1a1a' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #1e1e24', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#444' }}>
            {requesting.length} card{requesting.length !== 1 ? 's' : ''} requested
            {offering.length > 0 ? `, ${offering.length} offered` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #2a2a32', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || requesting.length === 0}
              style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: submitting || requesting.length === 0 ? '#1e1e28' : '#4f46e5', color: submitting || requesting.length === 0 ? '#444' : '#fff', fontSize: 13, fontWeight: 600, cursor: requesting.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Sending…' : 'Send Offer'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}