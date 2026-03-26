'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface CommunityPreview {
    id: number;
    name: string;
    description: string;
    owner_name: string;
}

type Props = {
    open: boolean;
    onClose: () => void;
    onJoined: () => void; // callback to refresh community list in parent
};

type Step = 'enter-code' | 'confirm';

export default function JoinCommunityModal({ open, onClose, onJoined }: Props) {
    const [step, setStep] = useState<Step>('enter-code');
    const [code, setCode] = useState('');
    const [preview, setPreview] = useState<CommunityPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on open, reset on close
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setStep('enter-code');
            setCode('');
            setPreview(null);
            setError(null);
        }
    }, [open]);

    const handleLookup = useCallback(async () => {
        if (!code.trim()) return;
        setLoading(true);
        setError(null);

        // 1. Find community by access code
        const { data: community, error: communityError } = await supabase
            .from('communities')
            .select('id, name, description, owner_id')
            .eq('access_code', code.trim().toUpperCase())
            .maybeSingle();

        if (communityError || !community) {
            setError('No community found with that code. Please check and try again.');
            setLoading(false);
            return;
        }

        // 2. Check user isn't already a member
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: existing } = await supabase
            .from('user_communities')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('community_id', community.id)
            .maybeSingle();

        if (existing) {
            setError('You are already a member of this community.');
            setLoading(false);
            return;
        }

        // 3. Fetch owner display name
console.log('Looking up owner with id:', community.owner_id);

const { data: owner, error: ownerError } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', community.owner_id)
    .maybeSingle();

console.log('Owner result:', owner);
console.log('Owner error:', ownerError);

setPreview({
    id: community.id,
    name: community.name,
    description: community.description,
    owner_name: owner?.display_name ?? 'Unknown',
});
        setStep('confirm');
        setLoading(false);
    }, [code]);

    const handleJoin = useCallback(async () => {
        if (!preview) return;
        setLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { error: joinError } = await supabase
            .from('user_communities')
            .insert({
                user_id: session.user.id,
                community_id: preview.id,
                role: 'member',
            });

        if (joinError) {
            setError('Failed to join community. Please try again.');
            setLoading(false);
            return;
        }

        onJoined(); // refresh parent list
        onClose();
    }, [preview, onJoined, onClose]);

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
                    width: '100%', maxWidth: 440,
                    background: '#111115', border: '1px solid #2a2a32',
                    borderRadius: 14, overflow: 'hidden',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                    fontFamily: "'DM Sans','Segoe UI',sans-serif",
                }}
            >
                {/* ── Header ── */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e24', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e6e0' }}>
                        {step === 'enter-code' ? 'Join a community' : 'Community found'}
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

                {/* ── Body ── */}
                <div style={{ padding: '20px' }}>
                    {step === 'enter-code' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>
                                Enter access code
                            </label>
                            <input
                                ref={inputRef}
                                value={code}
                                onChange={e => { setCode(e.target.value); setError(null); }}
                                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                                placeholder="e.g. X4KQ2M"
                                maxLength={8}
                                style={{
                                    width: '100%', padding: '10px 12px',
                                    background: '#18181e', border: `1px solid ${error ? '#ef4444' : '#2a2a32'}`,
                                    borderRadius: 8, color: '#e8e6e0', fontSize: 16,
                                    fontWeight: 700, letterSpacing: 4,
                                    outline: 'none', fontFamily: 'monospace',
                                    boxSizing: 'border-box', textTransform: 'uppercase',
                                }}
                            />
                            {error && (
                                <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>
                            )}
                        </div>
                    ) : preview ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Community card */}
                            <div style={{ background: '#18181e', border: '1px solid #2a2a32', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#e8e6e0' }}>{preview.name}</span>
                                {preview.description && (
                                    <span style={{ fontSize: 13, color: '#888', lineHeight: 1.5 }}>{preview.description}</span>
                                )}
                                <span style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                                    Owned by <span style={{ color: '#818cf8' }}>{preview.owner_name}</span>
                                </span>
                            </div>
                            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                                Do you want to join <strong style={{ color: '#e8e6e0' }}>{preview.name}</strong>?
                            </p>
                            {error && (
                                <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* ── Footer ── */}
                <div style={{
                    padding: '12px 20px', borderTop: '1px solid #1e1e24',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                    {/* Back button on confirm step */}
                    {step === 'confirm' && (
                        <button
                            onClick={() => { setStep('enter-code'); setPreview(null); setError(null); }}
                            style={{
                                padding: '8px 14px', borderRadius: 8,
                                border: '1px solid #2a2a32', background: 'transparent',
                                color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            }}
                        >
                            ← Back
                        </button>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
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
                            onClick={step === 'enter-code' ? handleLookup : handleJoin}
                            disabled={loading || (step === 'enter-code' && !code.trim())}
                            style={{
                                padding: '8px 20px', borderRadius: 8, border: 'none',
                                background: loading || (step === 'enter-code' && !code.trim()) ? '#2a2a38' : '#4f46e5',
                                color: loading || (step === 'enter-code' && !code.trim()) ? '#555' : '#fff',
                                fontSize: 13, fontWeight: 600,
                                cursor: loading || (step === 'enter-code' && !code.trim()) ? 'not-allowed' : 'pointer',
                                transition: 'background 0.15s, color 0.15s',
                            }}
                        >
                            {loading ? 'Loading…' : step === 'enter-code' ? 'Look up' : 'Join Community'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}