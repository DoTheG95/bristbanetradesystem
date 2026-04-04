'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '../components/Navbar';
import { Trade, TradeItem, TradeMessage, TradeStatus } from '@/lib/tradeTypes';
import { Suspense } from 'react';

type TabType = 'incoming' | 'outgoing' | 'history';

const STATUS_COLOURS: Record<TradeStatus, string> = {
  pending:   '#f59e0b',
  accepted:  '#4ade80',
  declined:  '#c0392b',
  cancelled: '#555',
  countered: '#a78bfa',
};

function OffersContent() {
  const searchParams                          = useSearchParams();
  const [userId, setUserId]                   = useState<string | null>(null);
  const [checking, setChecking]               = useState(true);
  const [activeTab, setActiveTab]             = useState<TabType>('incoming');
  const [trades, setTrades]                   = useState<Trade[]>([]);
  const [loadingTrades, setLoadingTrades]     = useState(false);
  const [expandedId, setExpandedId]           = useState<string | null>(null);
  const [messages, setMessages]               = useState<Record<string, TradeMessage[]>>({});
  const [newMessage, setNewMessage]           = useState('');
  const [sendingMsg, setSendingMsg]           = useState(false);
  const [actionLoading, setActionLoading]     = useState<string | null>(null); // trade id being actioned
  const msgEndRef                             = useRef<HTMLDivElement>(null);

  // Counter-offer modal state
  const [counterTrade, setCounterTrade]       = useState<Trade | null>(null);
  const [counterMsg, setCounterMsg]           = useState('');
  const [counterDate, setCounterDate]         = useState('');
  const [submittingCounter, setSubmittingCounter] = useState(false);

  /* ── auth ── */
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.replace('/'); return; }
      setUserId(session.user.id);
      setChecking(false);
    });
  }, []);

  /* ── load trades ── */
  const loadTrades = useCallback(async (tab: TabType, uid: string) => {
    setLoadingTrades(true);
    setTrades([]);

    let query = supabase
      .from('trades')
      .select(`
        id, sender_id, receiver_id, status, meet_date, created_at, updated_at,
        trade_items ( id, trade_id, offered_by, tcgplayer_id, tcgplayer_name, card_number, qty )
      `)
      .order('updated_at', { ascending: false });

    if (tab === 'incoming') {
      query = query.eq('receiver_id', uid).eq('status', 'pending');
    } else if (tab === 'outgoing') {
      query = query.eq('sender_id', uid).in('status', ['pending', 'countered']);
    } else {
      query = query
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
        .in('status', ['accepted', 'declined', 'cancelled']);
    }

    const { data, error } = await query;
    if (error) { console.error(error); setLoadingTrades(false); return; }

    // Fetch display names for all relevant user ids
    const uids = Array.from(new Set((data ?? []).flatMap(t => [t.sender_id, t.receiver_id])));
    const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', uids);
    const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.display_name ?? 'Unknown']));

    setTrades((data ?? []).map(t => ({
      ...t,
      sender_display_name:   nameMap[t.sender_id],
      receiver_display_name: nameMap[t.receiver_id],
      items: t.trade_items as TradeItem[],
    })));
    setLoadingTrades(false);
  }, []);

  useEffect(() => {
    if (checking || !userId) return;
    loadTrades(activeTab, userId);
  }, [activeTab, checking, userId, loadTrades]);

  /* ── open trade from URL param ── */
  useEffect(() => {
    const tradeId = searchParams?.get('trade');
    if (tradeId) setExpandedId(tradeId);
  }, [searchParams]);

  /* ── load messages for expanded trade ── */
  useEffect(() => {
    if (!expandedId) return;
    const load = async () => {
      const { data } = await supabase
        .from('trade_messages')
        .select('*')
        .eq('trade_id', expandedId)
        .order('created_at', { ascending: true });

      // Fetch sender names
      const uids = Array.from(new Set((data ?? []).map(m => m.sender_id)));
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', uids);
      const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.display_name ?? 'Unknown']));

      setMessages(prev => ({
        ...prev,
        [expandedId]: (data ?? []).map(m => ({ ...m, sender_display_name: nameMap[m.sender_id] })),
      }));
    };
    load();

    // Mark notifications for this trade as read
    if (userId) {
      supabase.from('notifications')
        .update({ read: true })
        .eq('trade_id', expandedId)
        .eq('user_id', userId)
        .then(() => {});
    }
  }, [expandedId, userId]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, expandedId]);

  /* ── send message ── */
  const sendMessage = useCallback(async (tradeId: string, trade: Trade) => {
    if (!userId || !newMessage.trim()) return;
    setSendingMsg(true);
    const { data: msg } = await supabase.from('trade_messages').insert({
      trade_id: tradeId, sender_id: userId, message: newMessage.trim(),
    }).select('*').single();

    if (msg) {
      setMessages(prev => ({
        ...prev,
        [tradeId]: [...(prev[tradeId] ?? []), { ...msg, sender_display_name: 'You' }],
      }));
      setNewMessage('');

      // Notify the other party
      const otherId = trade.sender_id === userId ? trade.receiver_id : trade.sender_id;
      await supabase.from('notifications').insert({ user_id: otherId, trade_id: tradeId, type: 'message_received' });
    }
    setSendingMsg(false);
  }, [userId, newMessage]);

  const acceptTrade = useCallback(async (trade: Trade) => {
    if (!userId) return;
    setActionLoading(trade.id);
    try {
      for (const item of (trade.items ?? [])) {
        const providerId  = item.offered_by;
        const receiverId  = item.offered_by === trade.sender_id
          ? trade.receiver_id   // sender is giving → receiver gets it
          : trade.sender_id;    // receiver is giving → sender gets it
  
        // 1. Deduct from provider's tradelist
        const { data: providerEntry } = await supabase
          .from('user_cards')
          .select('id, quantity')
          .eq('user_id', providerId)
          .eq('tcgplayer_id', item.tcgplayer_id)
          .eq('list_type', 'tradelist')
          .maybeSingle();
  
        if (providerEntry) {
          if (providerEntry.quantity != null && item.qty != null) {
            const newQty = providerEntry.quantity - item.qty;
            if (newQty <= 0) {
              await supabase.from('user_cards').delete().eq('id', providerEntry.id);
            } else {
              await supabase.from('user_cards').update({ quantity: newQty }).eq('id', providerEntry.id);
            }
          }
          // both null — leave as-is
        }
  
        // 2. Deduct from receiver's wishlist
        const { data: receiverWishEntry } = await supabase
          .from('user_cards')
          .select('id, quantity')
          .eq('user_id', receiverId)
          .eq('tcgplayer_id', item.tcgplayer_id)
          .eq('list_type', 'wishlist')
          .maybeSingle();
  
        if (receiverWishEntry) {
          if (receiverWishEntry.quantity != null && item.qty != null) {
            const newQty = receiverWishEntry.quantity - item.qty;
            if (newQty <= 0) {
              await supabase.from('user_cards').delete().eq('id', receiverWishEntry.id);
            } else {
              await supabase.from('user_cards').update({ quantity: newQty }).eq('id', receiverWishEntry.id);
            }
          } else {
            // wishlist qty is null — trade fulfilled it, remove entirely
            await supabase.from('user_cards').delete().eq('id', receiverWishEntry.id);
          }
        }
      }
  
      await supabase.from('trades').update({ status: 'accepted' }).eq('id', trade.id);
      await supabase.from('notifications').insert({
        user_id:  trade.sender_id,
        trade_id: trade.id,
        type:     'offer_accepted',
      });
  
      loadTrades(activeTab, userId);
    } catch (err) {
      console.error('Accept error:', err);
    } finally {
      setActionLoading(null);
    }
  }, [userId, activeTab, loadTrades]);

  /* ── decline trade ── */
  const declineTrade = useCallback(async (trade: Trade) => {
    if (!userId) return;
    setActionLoading(trade.id);
    await supabase.from('trades').update({ status: 'declined' }).eq('id', trade.id);
    await supabase.from('notifications').insert({ user_id: trade.sender_id, trade_id: trade.id, type: 'offer_declined' });
    loadTrades(activeTab, userId);
    setActionLoading(null);
  }, [userId, activeTab, loadTrades]);

  /* ── cancel trade ── */
  const cancelTrade = useCallback(async (trade: Trade) => {
    if (!userId) return;
    setActionLoading(trade.id);
    await supabase.from('trades').update({ status: 'cancelled' }).eq('id', trade.id);
    const otherId = trade.sender_id === userId ? trade.receiver_id : trade.sender_id;
    await supabase.from('notifications').insert({ user_id: otherId, trade_id: trade.id, type: 'offer_cancelled' });
    loadTrades(activeTab, userId);
    setActionLoading(null);
  }, [userId, activeTab, loadTrades]);

  /* ── counter offer ── */
  const submitCounter = useCallback(async () => {
    if (!userId || !counterTrade) return;
    setSubmittingCounter(true);
    // Update existing trade to countered + add a message
    await supabase.from('trades').update({
      status: 'countered',
      meet_date: counterDate || counterTrade.meet_date,
    }).eq('id', counterTrade.id);

    if (counterMsg.trim()) {
      await supabase.from('trade_messages').insert({
        trade_id: counterTrade.id, sender_id: userId, message: `[Counter-offer] ${counterMsg.trim()}`,
      });
    }

    const otherId = counterTrade.sender_id === userId ? counterTrade.receiver_id : counterTrade.sender_id;
    await supabase.from('notifications').insert({ user_id: otherId, trade_id: counterTrade.id, type: 'counter_received' });

    setCounterTrade(null);
    setCounterMsg('');
    setCounterDate('');
    setSubmittingCounter(false);
    loadTrades(activeTab, userId);
  }, [userId, counterTrade, counterMsg, counterDate, activeTab, loadTrades]);

  if (checking || !userId) return null;

  const tabTrades = trades;

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0e', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: '#e8e6e0' }}>
      <Navbar />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px' }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', margin: 0, color: '#e8e6e0' }}>Offers</h1>
          <p style={{ fontSize: 14, color: '#555', marginTop: 6 }}>Manage your incoming and outgoing trade offers.</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#141418', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {(['incoming', 'outgoing', 'history'] as TabType[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '7px 20px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === tab ? '#1e1e28' : 'transparent',
              color: activeTab === tab ? '#e8e6e0' : '#555',
              boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
              textTransform: 'capitalize',
            }}>{tab}</button>
          ))}
        </div>

        {/* Trade list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadingTrades ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#444', fontSize: 13 }}>Loading…</div>
          ) : tabTrades.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#333', fontSize: 14 }}>No {activeTab} offers.</div>
          ) : tabTrades.map(trade => {
            const isExpanded   = expandedId === trade.id;
            const isSender     = trade.sender_id === userId;
            const otherName    = isSender ? trade.receiver_display_name : trade.sender_display_name;
            const myItems      = (trade.items ?? []).filter(i => i.offered_by === userId);
            const theirItems   = (trade.items ?? []).filter(i => i.offered_by !== userId);
            const isActioning  = actionLoading === trade.id;
            const tradeMessages = messages[trade.id] ?? [];

            return (
              <div key={trade.id} style={{ background: '#111115', border: `1px solid ${isExpanded ? '#2a2a3a' : '#1e1e24'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.15s' }}>

                {/* Trade row header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: `hsl(${(otherName?.charCodeAt(0) ?? 0) * 7 % 360}, 40%, 18%)`,
                    border: `2px solid hsl(${(otherName?.charCodeAt(0) ?? 0) * 7 % 360}, 55%, 32%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: `hsl(${(otherName?.charCodeAt(0) ?? 0) * 7 % 360}, 75%, 65%)`,
                  }}>
                    {(otherName ?? '?').charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e6e0' }}>
                      {isSender ? `To: ${otherName}` : `From: ${otherName}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>
                      {(trade.items ?? []).length} card{(trade.items ?? []).length !== 1 ? 's' : ''}
                      {trade.meet_date ? ` · ${trade.meet_date}` : ''}
                      {' · '}{new Date(trade.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Card thumbnails */}
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    {(trade.items ?? []).slice(0, 4).map(item => (
                      <img key={item.id} src={`https://tcgplayer-cdn.tcgplayer.com/product/${item.tcgplayer_id}_in_200x200.jpg`} alt={item.tcgplayer_name} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 3 }} />
                    ))}
                    {(trade.items ?? []).length > 4 && <div style={{ width: 28, height: 28, borderRadius: 3, background: '#1e1e28', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#555' }}>+{(trade.items ?? []).length - 4}</div>}
                  </div>

                  {/* Status badge */}
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: STATUS_COLOURS[trade.status], flexShrink: 0 }}>
                    {trade.status}
                  </span>

                  <span style={{ color: '#333', fontSize: 12, flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #1e1e24', padding: '16px' }}>

                    {/* Items breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: theirItems.length > 0 && myItems.length > 0 ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 16 }}>
                      {theirItems.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                            {isSender ? 'Requesting from them' : 'They want from you'}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {theirItems.map(item => (
                              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', background: '#16161c', borderRadius: 6 }}>
                                <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${item.tcgplayer_id}_in_200x200.jpg`} alt={item.tcgplayer_name} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.tcgplayer_name}</div>
                                  <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>{item.card_number}</div>
                                </div>
                                {item.qty != null && <span style={{ fontSize: 10, color: '#555', flexShrink: 0 }}>×{item.qty}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {myItems.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                            {isSender ? 'You are offering' : 'They are offering'}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {myItems.map(item => (
                              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', background: '#16161c', border: '1px solid #2a2218', borderRadius: 6 }}>
                                <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${item.tcgplayer_id}_in_200x200.jpg`} alt={item.tcgplayer_name} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.tcgplayer_name}</div>
                                  <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>{item.card_number}</div>
                                </div>
                                {item.qty != null && <span style={{ fontSize: 10, color: '#555', flexShrink: 0 }}>×{item.qty}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Message thread */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Messages</div>
                      <div style={{ background: '#0e0e12', borderRadius: 8, padding: '10px', maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {tradeMessages.length === 0 ? (
                          <div style={{ fontSize: 12, color: '#333', textAlign: 'center', padding: '12px 0' }}>No messages yet.</div>
                        ) : tradeMessages.map(msg => {
                          const isMe = msg.sender_id === userId;
                          return (
                            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                              <div style={{ fontSize: 10, color: '#444', marginBottom: 2 }}>{isMe ? 'You' : msg.sender_display_name}</div>
                              <div style={{ fontSize: 12, color: '#d4d2cc', background: isMe ? '#1e1e30' : '#18181e', padding: '6px 10px', borderRadius: 8, maxWidth: '80%' }}>
                                {msg.message}
                              </div>
                            </div>
                          );
                        })}
                        <div ref={msgEndRef} />
                      </div>
                      {(trade.status === 'pending' || trade.status === 'countered') && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <input
                            type="text"
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendMessage(trade.id, trade)}
                            placeholder="Send a message…"
                            style={{ flex: 1, padding: '6px 10px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 7, color: '#d4d2cc', fontSize: 12, outline: 'none' }}
                          />
                          <button
                            onClick={() => sendMessage(trade.id, trade)}
                            disabled={sendingMsg || !newMessage.trim()}
                            style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {sendingMsg ? '…' : '→'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {trade.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => cancelTrade(trade)}
                          disabled={isActioning}
                          style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #2a2a32', background: 'transparent', color: '#555', fontSize: 12, cursor: 'pointer' }}
                        >Cancel</button>

                        {!isSender && (
                          <>
                            <button
                              onClick={() => { setCounterTrade(trade); setCounterDate(trade.meet_date ?? ''); }}
                              disabled={isActioning}
                              style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #a78bfa', background: 'transparent', color: '#a78bfa', fontSize: 12, cursor: 'pointer' }}
                            >Counter</button>
                            <button
                              onClick={() => declineTrade(trade)}
                              disabled={isActioning}
                              style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #c0392b', background: 'transparent', color: '#c0392b', fontSize: 12, cursor: 'pointer' }}
                            >Decline</button>
                            <button
                              onClick={() => acceptTrade(trade)}
                              disabled={isActioning}
                              style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: isActioning ? '#1e1e28' : '#4ade80', color: isActioning ? '#444' : '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >{isActioning ? '…' : 'Accept'}</button>
                          </>
                        )}
                      </div>
                    )}

                    {trade.status === 'countered' && (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => cancelTrade(trade)} disabled={isActioning} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #2a2a32', background: 'transparent', color: '#555', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        {isSender && (
                          <button onClick={() => acceptTrade(trade)} disabled={isActioning} style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: '#4ade80', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            {isActioning ? '…' : 'Accept Counter'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Counter-offer modal */}
      {counterTrade && (
        <div onClick={() => setCounterTrade(null)} style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#111115', border: '1px solid #1e1e24', borderRadius: 14, padding: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.8)', animation: 'modalIn 0.18s ease' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#e8e6e0' }}>Send Counter-Offer</h3>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Your message</div>
            <textarea
              value={counterMsg}
              onChange={e => setCounterMsg(e.target.value)}
              placeholder="Explain your counter-offer…"
              rows={3}
              style={{ width: '100%', padding: '8px 10px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 7, color: '#d4d2cc', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }}
            />
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Proposed date (optional)</div>
            <input type="date" value={counterDate} onChange={e => setCounterDate(e.target.value)} style={{ padding: '6px 10px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 7, color: '#d4d2cc', fontSize: 13, outline: 'none', colorScheme: 'dark', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setCounterTrade(null)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #2a2a32', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitCounter} disabled={submittingCounter} style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: '#a78bfa', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {submittingCounter ? 'Sending…' : 'Send Counter'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default function OffersPage() {
  return (
    <Suspense fallback={null}>
      <OffersContent />
    </Suspense>
  );
}