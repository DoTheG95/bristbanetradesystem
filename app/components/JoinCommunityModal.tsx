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
            className="ca-modal-overlay"
            style={{ background: 'rgba(0,0,0,0.7)' }}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="ca-modal"
                style={{ maxWidth: 440 }}
            >
                {/* ── Header ── */}
                <div className="ca-modal-header">
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ca-text)' }}>
                        {step === 'enter-code' ? 'Join a community' : 'Community found'}
                    </span>
                    <button onClick={onClose} className="ca-icon-btn ca-icon-btn--sm">×</button>
                </div>

                {/* ── Body ── */}
                <div style={{ padding: 20 }}>
                    {step === 'enter-code' ? (
                        <div className="ca-field-group">
                            <label className="ca-field-label">
                                Enter access code
                            </label>
                            <input
                                ref={inputRef}
                                value={code}
                                onChange={e => { setCode(e.target.value); setError(null); }}
                                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                                placeholder="e.g. X4KQ2M"
                                maxLength={8}
                                className={`ca-code-input${error ? ' is-error' : ''}`}
                            />
                            {error && (
                                <span style={{ fontSize: 12, color: 'var(--ca-red-bright)' }}>{error}</span>
                            )}
                        </div>
                    ) : preview ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Community card */}
                            <div className="ca-preview-card">
                                <span className="ca-preview-name">{preview.name}</span>
                                {preview.description && (
                                    <span className="ca-preview-desc">{preview.description}</span>
                                )}
                                <span className="ca-preview-owner">
                                    Owned by <span style={{ color: 'var(--ca-accent-soft)' }}>{preview.owner_name}</span>
                                </span>
                            </div>
                            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                                Do you want to join <strong style={{ color: 'var(--ca-text)' }}>{preview.name}</strong>?
                            </p>
                            {error && (
                                <span style={{ fontSize: 12, color: 'var(--ca-red-bright)' }}>{error}</span>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* ── Footer ── */}
                <div className="ca-modal-footer">
                    {/* Back button on confirm step */}
                    {step === 'confirm' ? (
                        <button
                            onClick={() => { setStep('enter-code'); setPreview(null); setError(null); }}
                            className="ca-btn ca-btn-ghost"
                            style={{ padding: '8px 14px' }}
                        >
                            ← Back
                        </button>
                    ) : <span />}

                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                        <button onClick={onClose} className="ca-btn ca-btn-ghost" style={{ padding: '8px 16px' }}>
                            Cancel
                        </button>
                        <button
                            onClick={step === 'enter-code' ? handleLookup : handleJoin}
                            disabled={loading || (step === 'enter-code' && !code.trim())}
                            className="ca-btn ca-btn-primary"
                            style={{ padding: '8px 20px' }}
                        >
                            {loading ? 'Loading…' : step === 'enter-code' ? 'Look up' : 'Join Community'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
