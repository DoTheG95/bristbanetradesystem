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
        style={{
          position: 'relative', width: 34, height: 34, borderRadius: 8,
          border: '1px solid #2a2a32', background: 'transparent',
          color: '#888', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 16,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#eee'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a32'; e.currentTarget.style.color = '#888'; }}
        title="Offers & notifications"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16, borderRadius: 99,
            background: '#4f46e5', color: '#fff',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1,
            border: '1.5px solid #0c0c0e',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Toast stack */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => toast.tradeId && (window.location.href = `/offers?trade=${toast.tradeId}`)}
            style={{
              background: '#1a1a24', border: '1px solid #2a2a3a',
              borderRadius: 10, padding: '12px 16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              cursor: toast.tradeId ? 'pointer' : 'default',
              animation: 'toastIn 0.2s ease',
              display: 'flex', alignItems: 'center', gap: 10,
              maxWidth: 300,
            }}
          >
            <span style={{ fontSize: 18 }}>🔔</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e6e0' }}>{toast.label}</div>
              {toast.tradeId && <div style={{ fontSize: 11, color: '#4f46e5', marginTop: 2 }}>Click to view →</div>}
            </div>
            <button
              onClick={e => { e.stopPropagation(); setToasts(prev => prev.filter(t => t.id !== toast.id)); }}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', fontSize: 14, padding: 0, flexShrink: 0 }}
            >×</button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}