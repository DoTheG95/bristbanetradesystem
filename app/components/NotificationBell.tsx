'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Notification, NotificationType } from '@/lib/tradetypes';

const NOTIF_LABELS: Record<NotificationType, string> = {
  offer_received:   'New trade offer received',
  offer_accepted:   'Your offer was accepted!',
  offer_declined:   'Your offer was declined',
  offer_cancelled:  'A trade was cancelled',
  counter_received: 'You received a counter-offer',
  message_received: 'New message on a trade',
};

interface Toast {
  id: string;
  label: string;
  tradeId: string | null;
}

interface Props {
  userId: string;
}

export default function NotificationBell({ userId }: Props) {
  const [unread, setUnread]       = useState(0);
  const [toasts, setToasts]       = useState<Toast[]>([]);
  const channelRef                = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load initial unread count
  useEffect(() => {
    const load = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);
      setUnread(count ?? 0);
    };
    load();
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    channelRef.current = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const notif = payload.new as Notification;
          setUnread(prev => prev + 1);
          pushToast(notif);
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [userId]);

  const pushToast = (notif: Notification) => {
    const toast: Toast = {
      id:      notif.id,
      label:   NOTIF_LABELS[notif.type] ?? 'New notification',
      tradeId: notif.trade_id,
    };
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 4000);
  };

  const handleBellClick = () => {
    window.location.href = '/offers';
  };

  return (
    <>
      {/* Bell button */}
      <button
        onClick={handleBellClick}
        className="ca-bell-btn"
        title="Offers & notifications"
      >
        🔔
        {unread > 0 && (
          <span className="ca-bell-badge">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Toast stack */}
      <div className="ca-toast-stack">
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => toast.tradeId && (window.location.href = `/offers?trade=${toast.tradeId}`)}
            className={`ca-toast${toast.tradeId ? ' ca-toast--clickable' : ''}`}
          >
            <span style={{ fontSize: 18 }}>🔔</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ca-text)' }}>{toast.label}</div>
              {toast.tradeId && <div style={{ fontSize: 11, color: 'var(--ca-accent)', marginTop: 2 }}>Click to view →</div>}
            </div>
            <button
              onClick={e => { e.stopPropagation(); setToasts(prev => prev.filter(t => t.id !== toast.id)); }}
              className="ca-toast-close"
            >×</button>
          </div>
        ))}
      </div>
    </>
  );
}
