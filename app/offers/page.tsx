'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '../components/Navbar';
import { Trade, TradeItem, TradeMessage, TradeStatus } from '@/lib/tradetypes';
import { Suspense } from 'react';

type TabType = 'incoming' | 'outgoing' | 'history';

const STATUS_CLASS: Record<TradeStatus, string> = {
  pending:   'ca-status-pending',
  accepted:  'ca-status-accepted',
  declined:  'ca-status-declined',
  cancelled: 'ca-status-cancelled',
  countered: 'ca-status-countered',
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
    // Deduct qty from user_cards for each trade item where qty is not null
    for (const item of (trade.items ?? [])) {
      if (item.qty == null) continue; // null = uncountable, skip

      const { data: existing, error: fetchErr } = await supabase
        .from('user_cards')
        .select('id, quantity')
        .eq('user_id', item.offered_by)   // the person giving this card
        .eq('tcgplayer_id', item.tcgplayer_id)
        .eq('list_type', 'tradelist')
        .maybeSingle();                    // maybeSingle won't error if no row found

      if (fetchErr) { console.error('Fetch error:', fetchErr); continue; }
      if (!existing) { console.warn('No tradelist entry found for', item.tcgplayer_id, 'user', item.offered_by); continue; }

      // If existing qty is null (uncountable), leave it alone
      if (existing.quantity == null) continue;

      const newQty = existing.quantity - item.qty;
      if (newQty <= 0) {
        await supabase.from('user_cards').delete().eq('id', existing.id);
      } else {
        await supabase.from('user_cards').update({ quantity: newQty }).eq('id', existing.id);
      }
    }

    // Update status after deductions
    await supabase.from('trades').update({ status: 'accepted' }).eq('id', trade.id);

    // Notify sender
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
    <div className="ca-page">
      <Navbar />
      <div className="ca-container--wide">

        <div style={{ marginBottom: 28 }}>
          <h1 className="ca-list-title">Offers</h1>
          <p className="ca-list-subtitle" style={{ marginTop: 6 }}>Manage your incoming and outgoing trade offers.</p>
        </div>

        {/* Tabs */}
        <div className="ca-tabbar ca-tabbar--fit" style={{ marginBottom: 24 }}>
          {(['incoming', 'outgoing', 'history'] as TabType[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`ca-tab ca-tab--capitalize${activeTab === tab ? ' is-active' : ''}`}>{tab}</button>
          ))}
        </div>

        {/* Trade list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadingTrades ? (
            <div className="ca-simple-empty">Loading…</div>
          ) : tabTrades.length === 0 ? (
            <div className="ca-simple-empty ca-simple-empty--lg">No {activeTab} offers.</div>
          ) : tabTrades.map(trade => {
            const isExpanded   = expandedId === trade.id;
            const isSender     = trade.sender_id === userId;
            const otherName    = isSender ? trade.receiver_display_name : trade.sender_display_name;
            const myItems      = (trade.items ?? []).filter(i => i.offered_by === userId);
            const theirItems   = (trade.items ?? []).filter(i => i.offered_by !== userId);
            const isActioning  = actionLoading === trade.id;
            const tradeMessages = messages[trade.id] ?? [];

            return (
              <div key={trade.id} className={`ca-trade-card${isExpanded ? ' is-expanded' : ''}`}>

                {/* Trade row header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                  className="ca-trade-row"
                >
                  {/* Avatar */}
                  <div
                    className="ca-avatar ca-avatar--lg"
                    style={{ '--ca-hue': ((otherName?.charCodeAt(0) ?? 0) * 7) % 360 } as React.CSSProperties}
                  >
                    {(otherName ?? '?').charAt(0).toUpperCase()}
                  </div>

                  <div className="ca-trader-info">
                    <div className="ca-trader-name">
                      {isSender ? `To: ${otherName}` : `From: ${otherName}`}
                    </div>
                    <div className="ca-trade-meta">
                      {(trade.items ?? []).length} card{(trade.items ?? []).length !== 1 ? 's' : ''}
                      {trade.meet_date ? ` · ${trade.meet_date}` : ''}
                      {' · '}{new Date(trade.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Card thumbnails */}
                  <div className="ca-trade-thumbs">
                    {(trade.items ?? []).slice(0, 4).map(item => (
                      <img key={item.id} src={`https://tcgplayer-cdn.tcgplayer.com/product/${item.tcgplayer_id}_in_200x200.jpg`} alt={item.tcgplayer_name} className="ca-mini-card-thumb" />
                    ))}
                    {(trade.items ?? []).length > 4 && <div className="ca-trade-thumb-more">+{(trade.items ?? []).length - 4}</div>}
                  </div>

                  {/* Status badge */}
                  <span className={`ca-trade-status ${STATUS_CLASS[trade.status]}`}>
                    {trade.status}
                  </span>

                  <span className="ca-trade-chevron">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="ca-trade-detail">

                    {/* Items breakdown */}
                    <div className={`ca-trade-items-grid${!(theirItems.length > 0 && myItems.length > 0) ? ' ca-trade-items-grid--single' : ''}`}>
                      {theirItems.length > 0 && (
                        <div>
                          <div className="ca-match-section-label ca-match-section-label--theirs">
                            {isSender ? 'Requesting from them' : 'They want from you'}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {theirItems.map(item => (
                              <div key={item.id} className="ca-mini-card-row">
                                <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${item.tcgplayer_id}_in_200x200.jpg`} alt={item.tcgplayer_name} className="ca-mini-card-thumb" />
                                <div className="ca-mini-card-info">
                                  <div className="ca-mini-card-name">{item.tcgplayer_name}</div>
                                  <div className="ca-mini-card-number">{item.card_number}</div>
                                </div>
                                {item.qty != null && <span className="ca-mini-card-qty">×{item.qty}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {myItems.length > 0 && (
                        <div>
                          <div className="ca-match-section-label ca-match-section-label--mine">
                            {isSender ? 'You are offering' : 'They are offering'}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {myItems.map(item => (
                              <div key={item.id} className="ca-mini-card-row ca-mini-card-row--outlined">
                                <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${item.tcgplayer_id}_in_200x200.jpg`} alt={item.tcgplayer_name} className="ca-mini-card-thumb" />
                                <div className="ca-mini-card-info">
                                  <div className="ca-mini-card-name">{item.tcgplayer_name}</div>
                                  <div className="ca-mini-card-number">{item.card_number}</div>
                                </div>
                                {item.qty != null && <span className="ca-mini-card-qty">×{item.qty}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Message thread */}
                    <div style={{ marginBottom: 12 }}>
                      <div className="ca-modal-section-label ca-modal-section-label--muted">Messages</div>
                      <div className="ca-message-thread">
                        {tradeMessages.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--ca-text-shadow)', textAlign: 'center', padding: '12px 0' }}>No messages yet.</div>
                        ) : tradeMessages.map(msg => {
                          const isMe = msg.sender_id === userId;
                          return (
                            <div key={msg.id} className={`ca-message-row${isMe ? ' is-mine' : ''}`}>
                              <div className="ca-message-sender">{isMe ? 'You' : msg.sender_display_name}</div>
                              <div className={`ca-message-bubble${isMe ? ' is-mine' : ''}`}>
                                {msg.message}
                              </div>
                            </div>
                          );
                        })}
                        <div ref={msgEndRef} />
                      </div>
                      {(trade.status === 'pending' || trade.status === 'countered') && (
                        <div className="ca-message-input-row">
                          <input
                            type="text"
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendMessage(trade.id, trade)}
                            placeholder="Send a message…"
                            className="ca-message-input"
                          />
                          <button
                            onClick={() => sendMessage(trade.id, trade)}
                            disabled={sendingMsg || !newMessage.trim()}
                            className="ca-message-send-btn"
                          >
                            {sendingMsg ? '…' : '→'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {trade.status === 'pending' && (
                      <div className="ca-trade-actions">
                        <button
                          onClick={() => cancelTrade(trade)}
                          disabled={isActioning}
                          className="ca-btn ca-btn-ghost ca-btn-md"
                        >Cancel</button>

                        {!isSender && (
                          <>
                            <button
                              onClick={() => { setCounterTrade(trade); setCounterDate(trade.meet_date ?? ''); }}
                              disabled={isActioning}
                              className="ca-btn ca-btn-purple ca-btn-md"
                            >Counter</button>
                            <button
                              onClick={() => declineTrade(trade)}
                              disabled={isActioning}
                              className="ca-btn ca-btn-outline-danger ca-btn-md"
                            >Decline</button>
                            <button
                              onClick={() => acceptTrade(trade)}
                              disabled={isActioning}
                              className="ca-btn ca-btn-success"
                              style={{ padding: '7px 20px' }}
                            >{isActioning ? '…' : 'Accept'}</button>
                          </>
                        )}
                      </div>
                    )}

                    {trade.status === 'countered' && (
                      <div className="ca-trade-actions">
                        <button onClick={() => cancelTrade(trade)} disabled={isActioning} className="ca-btn ca-btn-ghost ca-btn-md">Cancel</button>
                        {isSender && (
                          <button onClick={() => acceptTrade(trade)} disabled={isActioning} className="ca-btn ca-btn-success" style={{ padding: '7px 20px' }}>
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
        <div onClick={() => setCounterTrade(null)} className="ca-modal-overlay">
          <div onClick={e => e.stopPropagation()} className="ca-modal ca-modal--sm" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--ca-text)' }}>Send Counter-Offer</h3>
            <div className="ca-modal-section-label ca-modal-section-label--muted">Your message</div>
            <textarea
              value={counterMsg}
              onChange={e => setCounterMsg(e.target.value)}
              placeholder="Explain your counter-offer…"
              rows={3}
              className="ca-textarea"
              style={{ marginBottom: 12 }}
            />
            <div className="ca-modal-section-label ca-modal-section-label--muted">Proposed date (optional)</div>
            <input type="date" value={counterDate} onChange={e => setCounterDate(e.target.value)} className="ca-date-input" style={{ marginBottom: 16 }} />
            <div className="ca-trade-actions">
              <button onClick={() => setCounterTrade(null)} className="ca-btn ca-btn-ghost ca-btn-md">Cancel</button>
              <button onClick={submitCounter} disabled={submittingCounter} className="ca-btn ca-btn-purple-solid ca-btn-md">
                {submittingCounter ? 'Sending…' : 'Send Counter'}
              </button>
            </div>
          </div>
        </div>
      )}
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
