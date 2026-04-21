'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import SearchModal from './SearchModal';

interface Community {
    id: number;
    name: string;
}

interface Props {
    userId: string;
    displayName: string | null;
    userCommunities: Community[];
    onPostCreated: () => void;
    currentCommunityId?: number | null;
}

export default function CreatePostBox({ userId, displayName, userCommunities, onPostCreated, currentCommunityId }: Props) {
    const [content, setContent]             = useState('');
    const [postType, setPostType]           = useState('tradelist');
    const [selectedCards, setSelectedCards] = useState<any[]>([]);
    const [showSearch, setShowSearch]       = useState(false);
    const [submitting, setSubmitting]       = useState(false);
    const [onlyCash, setOnlyCash]           = useState(false);

    // Audience: isPublic = visible to everyone, selectedCommunityIds = integer community IDs
    const hasDefaultCommunity = typeof currentCommunityId === 'number';

    const [isPublic, setIsPublic] = useState(!hasDefaultCommunity);
    const [selectedCommunityIds, setSelectedCommunityIds] = useState<number[]>(
    hasDefaultCommunity ? [currentCommunityId!] : []
    );

    const togglePublic = () => {
        setIsPublic(p => !p);
    };

    const toggleCommunity = (id: number) => {
        setSelectedCommunityIds(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const audienceSummary = () => {
        const parts: string[] = [];
        if (isPublic) parts.push('Public');
        const names = userCommunities
            .filter(c => selectedCommunityIds.includes(c.id))
            .map(c => c.name);
        parts.push(...names);
        return parts.length > 0 ? parts.join(' / ') : 'No audience selected';
    };

    const hasAudience = isPublic || selectedCommunityIds.length > 0;
    const canPost     = content.trim() && !submitting && hasAudience;

    const handleCreatePost = async () => {
        if (!canPost || !userId) return;
        setSubmitting(true);

        try {
            const cardSnapshot = selectedCards.map(c => ({
                tcgplayer_id:   String(c.tcgplayer_id ?? c.id),
                tcgplayer_name: c.tcgplayer_name,
                card_number:    c.card_number,
                rarity:         c.rarity,
            }));

            const { error: postError } = await supabase
                .from('posts')
                .insert({
                    user_id:       userId,
                    display_name:  displayName,
                    content,
                    post_type:     postType,
                    cards:         cardSnapshot,
                    cashonly:      onlyCash,
                    is_public:     isPublic,
                    community_ids: selectedCommunityIds, // integer[]
                });

            if (postError) throw postError;

            // Sync cards to user_cards if any were attached
            if (selectedCards.length > 0) {
                const userCardRows = selectedCards.map(c => ({
                    user_id:        userId,
                    list_type:      postType,
                    tcgplayer_id:   String(c.id ?? c.tcgplayer_id),
                    tcgplayer_name: c.tcgplayer_name,
                    card_number:    c.card_number,
                    rarity:         c.rarity,
                    quantity:       null,
                }));
                const { error: syncError } = await supabase.from('user_cards').insert(userCardRows);
                if (syncError && syncError.code !== '23505') console.error('Sync error:', syncError.message);
            }

            setContent('');
            setSelectedCards([]);
            setOnlyCash(false);
            setIsPublic(true);
            setSelectedCommunityIds([]);
            onPostCreated();
        } catch (err: any) {
            console.error('Post error:', err.message);
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        if (typeof currentCommunityId === 'number') {
            setIsPublic(false);
            setSelectedCommunityIds([currentCommunityId]);
        } else {
            setIsPublic(true);
            setSelectedCommunityIds([]);
        }

        // optional resets
        setContent('');
        setSelectedCards([]);
        setOnlyCash(false);

        }, [currentCommunityId]);

    return (
        <>
            <div style={{ background: '#111115', border: '1px solid #1e1e24', borderRadius: 12, overflow: 'hidden', marginBottom: 32 }}>
                <div style={{ padding: 16 }}>

                    {/* Row 1: post type + cash toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <select
                            value={postType}
                            onChange={e => setPostType(e.target.value)}
                            style={{ background: '#18181e', color: '#4f46e5', border: '1px solid #2a2a32', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, outline: 'none' }}
                        >
                            <option value="tradelist">Tradelist</option>
                            <option value="wishlist">Wishlist</option>
                        </select>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa' }}>Only Cash</span>
                            <button
                                onClick={() => setOnlyCash(!onlyCash)}
                                style={{ position: 'relative', width: 40, height: 20, borderRadius: 20, border: '1px solid #2a2a32', background: onlyCash ? '#22c55e' : '#3f3f46', transition: 'background 0.2s ease', cursor: 'pointer', padding: 0 }}
                            >
                                <span style={{ position: 'absolute', top: 2, left: onlyCash ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease' }} />
                            </button>
                        </div>
                    </div>

                    {/* Textarea */}
                    <textarea
                        placeholder="Describe your trade or post details..."
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        style={{ width: '100%', minHeight: 80, background: 'transparent', border: 'none', color: '#e8e6e0', fontSize: 15, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                    />

                    {/* Selected card chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                        {selectedCards.map((card, idx) => (
                            <div key={idx} style={{ background: '#1e1e28', border: '1px solid #2a2a32', padding: '4px 10px', borderRadius: 6, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: '#888' }}>{card.card_number}</span>
                                {card.tcgplayer_name}
                                <button onClick={() => setSelectedCards(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', color: '#555', cursor: 'pointer' }}>×</button>
                            </div>
                        ))}
                        <button onClick={() => setShowSearch(true)} style={{ background: 'transparent', border: '1px dashed #333', color: '#555', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                            + Add Cards
                        </button>
                    </div>

                    {/* Audience selector */}
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #1e1e24' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Post to</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {/* Public toggle */}
                            <button
                                onClick={togglePublic}
                                style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s', background: isPublic ? '#1e1e32' : 'transparent', borderColor: isPublic ? '#4f46e5' : '#2a2a32', color: isPublic ? '#818cf8' : '#555' }}
                            >
                                Public
                            </button>

                            {/* Community toggles — ids are integers */}
                            {userCommunities.map(c => {
                                const active = selectedCommunityIds.includes(c.id);
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => toggleCommunity(c.id)}
                                        style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s', background: active ? '#1e1e32' : 'transparent', borderColor: active ? '#4f46e5' : '#2a2a32', color: active ? '#818cf8' : '#555' }}
                                    >
                                        {c.name}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: '#444', fontStyle: 'italic' }}>
                            Posting to: <span style={{ color: '#818cf8' }}>{audienceSummary()}</span>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '12px 16px', background: '#0e0e12', borderTop: '1px solid #1e1e24', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleCreatePost}
                        disabled={!canPost}
                        style={{ padding: '8px 24px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: canPost ? 'pointer' : 'not-allowed', background: canPost ? '#4f46e5' : '#1e1e28', color: canPost ? '#fff' : '#444' }}
                    >
                        {submitting ? 'Posting...' : 'Post'}
                    </button>
                </div>
            </div>

            <SearchModal
                open={showSearch}
                onClose={() => setShowSearch(false)}
                onAdd={cards => {
                    setSelectedCards(prev => [...prev, ...(Array.isArray(cards) ? cards : [cards])]);
                    setShowSearch(false);
                }}
            />
        </>
    );
}