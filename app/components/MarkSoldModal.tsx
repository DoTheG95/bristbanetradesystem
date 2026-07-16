'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  cardName: string;
  maxQty: number;
  onClose: () => void;
  onConfirm: (soldQty: number) => void;
}

export default function MarkSoldModal({ open, cardName, maxQty, onClose, onConfirm }: Props) {
  const [qty, setQty] = useState(maxQty);

  useEffect(() => {
    if (open) setQty(maxQty);
  }, [open, maxQty]);

  if (!open) return null;

  const dec = () => setQty(q => Math.max(1, q - 1));
  const inc = () => setQty(q => Math.min(maxQty, q + 1));

  const handleConfirm = () => {
    onConfirm(qty);
    onClose();
  };

  return (
    <div onClick={onClose} className="ca-modal-overlay">
      <div onClick={e => e.stopPropagation()} className="ca-modal ca-modal--sm" style={{ padding: 24 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--ca-text)' }}>Mark as sold</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--ca-text-faint)' }}>
          How many of <strong style={{ color: 'var(--ca-text-dim)' }}>{cardName}</strong> did you sell?
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div className="ca-qty-stepper" style={{ width: 120 }}>
            <button onClick={dec} className="ca-qty-stepper-btn">−</button>
            <div className="ca-qty-stepper-value">{qty}</div>
            <button onClick={inc} className="ca-qty-stepper-btn">+</button>
          </div>
          <span style={{ fontSize: 11, color: 'var(--ca-text-ghost)' }}>of {maxQty} available</span>
        </div>

        <div className="ca-trade-actions" style={{ marginTop: 20 }}>
          <button onClick={onClose} className="ca-btn ca-btn-ghost ca-btn-md">Cancel</button>
          <button onClick={handleConfirm} className="ca-btn ca-btn-primary ca-btn-md">Confirm</button>
        </div>
      </div>
    </div>
  );
}
