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
            style={{
                position: 'fixed', inset: 0, zIndex: 50,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.7)',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: 480,
                    background: '#111115', border: '1px solid #2a2a32',
                    borderRadius: 14, overflow: 'hidden',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                    fontFamily: "'DM Sans','Segoe UI',sans-serif",
                }}
            >
                {/* ── Header ── */}
                <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #1e1e24' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e6e0' }}>
                            Create a new community
                        </span>
                        <button
                            onClick={onClose}
                            style={{
                                width: 26, height: 26, borderRadius: 6,
                                border: '1px solid #2a2a32', background: 'transparent',
                                color: '#555', cursor: 'pointer', fontSize: 15,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Community name */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>
                            Community name
                        </label>
                        <input
                            ref={inputRef}
                            value={communityName}
                            onChange={e => setCommunityName(e.target.value)}
                            placeholder="e.g. Northside Traders"
                            style={{
                                width: '100%', padding: '9px 12px',
                                background: '#18181e', border: '1px solid #2a2a32',
                                borderRadius: 8, color: '#e8e6e0', fontSize: 13,
                                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Community description */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>
                            Description <span style={{ color: '#444', fontWeight: 400 }}>(optional)</span>
                        </label>
                        <textarea
                            value={communityDescription}
                            onChange={e => setCommunityDescription(e.target.value)}
                            placeholder="What is this community about?"
                            rows={3}
                            style={{
                                width: '100%', padding: '9px 12px',
                                background: '#18181e', border: '1px solid #2a2a32',
                                borderRadius: 8, color: '#e8e6e0', fontSize: 13,
                                outline: 'none', fontFamily: 'inherit', resize: 'vertical',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                </div>

                {/* ── Footer ── */}
                <div style={{
                    padding: '12px 20px', borderTop: '1px solid #1e1e24',
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px', borderRadius: 8,
                            border: '1px solid #2a2a32', background: 'transparent',
                            color: '#888', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreateCommunity}
                        disabled={!communityName.trim()}
                        style={{
                            padding: '8px 20px', borderRadius: 8,
                            border: 'none',
                            background: communityName.trim() ? '#4f46e5' : '#2a2a38',
                            color: communityName.trim() ? '#fff' : '#555',
                            fontSize: 13, fontWeight: 600,
                            cursor: communityName.trim() ? 'pointer' : 'not-allowed',
                            transition: 'background 0.15s, color 0.15s',
                        }}
                    >
                        Create Community
                    </button>
                </div>
            </div>
        </div>
    );
}