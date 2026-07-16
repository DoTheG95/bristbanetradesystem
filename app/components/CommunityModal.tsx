'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CommunityModal({ open, onClose }: Props) {
    const [communityName, setCommunityName] = useState('');
    const [communityDescription, setCommunityDescription] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus name input on open, reset fields on close
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setCommunityName('');
            setCommunityDescription('');
        }
    }, [open]);

    const generateUniqueAccessCode = async (): Promise<string | null> => {
        const MAX_ATTEMPTS = 5;

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

            // Check if this code already exists
            const { data } = await supabase
                .from('communities')
                .select('id')
                .eq('access_code', accessCode)
                .maybeSingle();

            if (!data) return accessCode; // code is free, use it
        }

        return null; // failed after MAX_ATTEMPTS (extremely unlikely)
    };


    const handleCreateCommunity = useCallback(async () => {
        if (!communityName.trim()) return;

        // 1. Get the current user
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const accessCode = await generateUniqueAccessCode();
        if (!accessCode) {
            console.error('Failed to generate a unique access code');
            return;
        }

        // 2. Insert the new community
        const { data: community, error: communityError } = await supabase
        .from('communities')
        .insert({
            name: communityName.trim(),
            description: communityDescription.trim(),
            access_code: accessCode, // generate a unique access code
            owner_id: session.user.id,
            admin_ids: [session.user.id], // creator is first admin
        })
    .select('id')
    .single();

        if (communityError || !community) {
            console.error('Failed to create community:', communityError);
            return;
        }

        // 3. Link the user to the new community
        const { error: joinError } = await supabase
            .from('user_communities')
            .insert({
                user_id: session.user.id,
                community_id: community.id
        });

    if (joinError) {
        console.error('Failed to join community:', joinError);
        return;
    }

    onClose();
    }, [communityName, communityDescription, onClose]);

    // ── Guard: don't render if closed ──
    if (!open) return null;

    return (
        <div
            onClick={onClose}
            className="ca-modal-overlay"
            style={{ background: 'rgba(0,0,0,0.7)' }}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="ca-modal ca-modal--sm"
            >
                {/* ── Header ── */}
                <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--ca-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ca-text)' }}>
                            Create a new community
                        </span>
                        <button onClick={onClose} className="ca-icon-btn ca-icon-btn--sm">×</button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Community name */}
                    <div className="ca-field-group">
                        <label className="ca-field-label">
                            Community name
                        </label>
                        <input
                            ref={inputRef}
                            value={communityName}
                            onChange={e => setCommunityName(e.target.value)}
                            placeholder="e.g. Northside Traders"
                            className="ca-input"
                        />
                    </div>

                    {/* Community description */}
                    <div className="ca-field-group">
                        <label className="ca-field-label">
                            Description <span style={{ color: 'var(--ca-text-ghost)', fontWeight: 400 }}>(optional)</span>
                        </label>
                        <textarea
                            value={communityDescription}
                            onChange={e => setCommunityDescription(e.target.value)}
                            placeholder="What is this community about?"
                            rows={3}
                            className="ca-textarea"
                        />
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="ca-modal-footer ca-modal-footer--end">
                    <button onClick={onClose} className="ca-btn ca-btn-ghost" style={{ padding: '8px 16px' }}>
                        Cancel
                    </button>
                    <button
                        onClick={handleCreateCommunity}
                        disabled={!communityName.trim()}
                        className="ca-btn ca-btn-primary"
                        style={{ padding: '8px 20px' }}
                    >
                        Create Community
                    </button>
                </div>
            </div>
        </div>
    );
}
