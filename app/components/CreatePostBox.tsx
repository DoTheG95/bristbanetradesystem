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
            <div className="ca-createpost">
                <div className="ca-createpost-body">

                    {/* Row 1: post type + cash toggle */}
                    <div className="ca-createpost-row1">
                        <select
                            value={postType}
                            onChange={e => setPostType(e.target.value)}
                            className="ca-type-select"
                        >
                            <option value="tradelist">Tradelist</option>
                            <option value="wishlist">Wishlist</option>
                        </select>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa' }}>Only Cash</span>
                            <button
                                onClick={() => setOnlyCash(!onlyCash)}
                                className={`ca-switch${onlyCash ? ' is-on' : ''}`}
                            >
                                <span className="ca-switch-knob" />
                            </button>
                        </div>
                    </div>

                    {/* Textarea */}
                    <textarea
                        placeholder="Describe your trade or post details..."
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        className="ca-post-textarea"
                    />

                    {/* Selected card chips */}
                    <div className="ca-createpost-chips">
                        {selectedCards.map((card, idx) => (
                            <div key={idx} className="ca-createpost-chip">
                                <span style={{ color: '#888' }}>{card.card_number}</span>
                                {card.tcgplayer_name}
                                <button onClick={() => setSelectedCards(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', color: '#555', cursor: 'pointer' }}>×</button>
                            </div>
                        ))}
                        <button onClick={() => setShowSearch(true)} className="ca-add-dashed-btn">
                            + Add Cards
                        </button>
                    </div>

                    {/* Audience selector */}
                    <div className="ca-audience-section">
                        <span className="ca-audience-label">Post to</span>
                        <div className="ca-audience-pills">
                            {/* Public toggle */}
                            <button
                                onClick={togglePublic}
                                className={`ca-pill-toggle${isPublic ? ' is-active' : ''}`}
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
                                        className={`ca-pill-toggle${active ? ' is-active' : ''}`}
                                    >
                                        {c.name}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="ca-audience-summary">
                            Posting to: <span style={{ color: '#818cf8' }}>{audienceSummary()}</span>
                        </div>
                    </div>
                </div>

                <div className="ca-createpost-footer">
                    <button
                        onClick={handleCreatePost}
                        disabled={!canPost}
                        className="ca-btn ca-btn-primary ca-btn-lg"
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
