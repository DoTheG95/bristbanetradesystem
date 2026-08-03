'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function UnregisterModal({ open, onClose }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const canConfirm = confirmText.trim().toUpperCase() === 'DELETE';

  const handleClose = () => {
    if (loading) return;
    setConfirmText('');
    setError(null);
    onClose();
  };

  const handleDelete = async () => {
    if (!canConfirm || loading) return;
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Your session has expired. Please log in again.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to delete account. Please try again.');
        setLoading(false);
        return;
      }

      await supabase.auth.signOut();
      window.location.replace('/');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div onClick={handleClose} className="ca-modal-overlay">
      <div onClick={e => e.stopPropagation()} className="ca-modal ca-modal--sm" style={{ padding: 24 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--ca-text)' }}>
          Delete your account
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ca-text-faint)', lineHeight: 1.5 }}>
          This removes your cards, posts, and follows, and disables your login for good. Past trades stay
          visible to the people you traded with, but your name is replaced with an anonymous ID. This can't be undone.
        </p>

        <label style={{ display: 'block', fontSize: 12, color: 'var(--ca-text-faint)', marginBottom: 6 }}>
          Type <strong style={{ color: 'var(--ca-text-dim)' }}>DELETE</strong> to confirm
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleDelete()}
          autoFocus
          disabled={loading}
          className="ca-auth-input ca-mb-12"
        />

        {error && <p className="ca-auth-error ca-mt-0 ca-mb-12">{error}</p>}

        <div className="ca-trade-actions" style={{ marginTop: 8 }}>
          <button onClick={handleClose} disabled={loading} className="ca-btn ca-btn-ghost ca-btn-md">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!canConfirm || loading}
            className="ca-btn ca-btn-danger-solid ca-btn-md"
          >
            {loading ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </div>
    </div>
  );
}
