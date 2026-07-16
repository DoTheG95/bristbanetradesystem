'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '../components/Navbar';
import CreatePostBox from '../components/CreatePostBox';
import MakeOfferModal from '../components/MakeOfferModal';

interface Community {
    id: number;
    name: string;
}

type FilterMode = 'all' | 'public' | number;

// Shape MakeOfferModal expects
interface MatchedCard {
    tcgplayer_id: string;
    tcgplayer_name: string;
    card_number: string | null;
    qty: number | null;
    price: number | null;
}

interface OfferTarget {
    receiverId: string;
    receiverName: string;
    cards: MatchedCard[];
}

export default function PostPage() {
    const [userId, setUserId]               = useState<string | null>(null);
    const [displayName, setDisplayName]     = useState<string | null>(null);
    const [posts, setPosts]                 = useState<any[]>([]);
    const [loading, setLoading]             = useState(true);
    const [searchText, setSearchText]       = useState('');
    const [filterMode, setFilterMode]       = useState<FilterMode>('all');
    const [userCommunities, setUserCommunities] = useState<Community[]>([]);
    const [offerTarget, setOfferTarget]     = useState<OfferTarget | null>(null);
    const [blockedIds, setBlockedIds]       = useState<Set<string>>(new Set());
    const inputRef                          = useRef<HTMLInputElement>(null);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) return window.location.replace('/');
            const { data: profile } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('id', session.user.id)
                .single();
            setUserId(session.user.id);
            setDisplayName(profile?.display_name ?? null);
            await fetchUserCommunities(session.user.id);
            await fetchBlockedIds(session.user.id);
            fetchPosts();
        });
    }, []);

    const fetchBlockedIds = async (uid: string) => {
        const { data } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', uid);
        setBlockedIds(new Set((data ?? []).map((r: any) => r.blocked_id)));
    };

    const fetchUserCommunities = async (uid: string) => {
        const { data: ucData } = await supabase
            .from('user_communities')
            .select('community_id')
            .eq('user_id', uid);
        const ids = (ucData ?? []).map((r: any) => r.community_id);
        if (ids.length === 0) return;
        const { data: cData } = await supabase
            .from('communities')
            .select('id, name')
            .in('id', ids);
        setUserCommunities(cData ?? []);
    };

    const fetchPosts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) console.error('Fetch error:', error.message);
        setPosts(data ?? []);
        setLoading(false);
    };

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm('Are you sure you want to delete this post?')) return;
        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', postId)
            .eq('user_id', userId);
        if (error) console.error('Delete error:', error.message);
        else fetchPosts();
    };

    // Open MakeOfferModal from a post — map post.cards → MatchedCard[]
    const handleMakeOffer = useCallback((post: any) => {
        if (!post.user_id || post.user_id === userId) return;
        const cards: MatchedCard[] = (post.cards ?? []).map((c: any) => ({
            tcgplayer_id:   String(c.tcgplayer_id ?? ''),
            tcgplayer_name: c.tcgplayer_name ?? '',
            card_number:    c.card_number ?? null,
            qty:            c.quantity ?? null,
            price:          c.price != null ? parseFloat(c.price) : null,
        }));
        setOfferTarget({
            receiverId:   post.user_id,
            receiverName: post.display_name ?? 'Trader',
            cards,
        });
    }, [userId]);

    const communityNameMap: Record<number, string> = {};
    userCommunities.forEach(c => { communityNameMap[c.id] = c.name; });

    const filteredPosts = posts
        .filter(post => !blockedIds.has(post.user_id))
        .filter(post => {
            if (filterMode === 'all') return true;
            if (filterMode === 'public') return post.is_public === true;
            return Array.isArray(post.community_ids) && post.community_ids.includes(filterMode);
        })
        .filter(post => {
            if (!searchText.trim()) return true;
            const q = searchText.toLowerCase();
            return (
                post.content?.toLowerCase().includes(q) ||
                post.display_name?.toLowerCase().includes(q) ||
                post.cards?.some((c: any) => c.tcgplayer_name?.toLowerCase().includes(q))
            );
        });

    if (!userId) return null;

    return (
        <div className="ca-page">
            <Navbar />

            <div className="ca-container--narrow">

                <CreatePostBox
                    userId={userId}
                    displayName={displayName}
                    userCommunities={userCommunities}
                    onPostCreated={fetchPosts}
                />

                {/* Filter tabs */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                    {(['all', 'public', ...userCommunities.map(c => c.id)] as FilterMode[]).map(mode => {
                        const label  = mode === 'all' ? 'All' : mode === 'public' ? 'Public' : userCommunities.find(c => c.id === mode)?.name ?? '';
                        const active = filterMode === mode;
                        return (
                            <button
                                key={String(mode)}
                                onClick={() => setFilterMode(mode)}
                                className={`ca-pill-toggle${active ? ' is-active' : ''}`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* Search */}
                <div className="ca-search-wrap" style={{ marginBottom: 20 }}>
                    <svg className="ca-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                        ref={inputRef}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        placeholder="Search posts, cards, or users..."
                        className="ca-input ca-input--search"
                    />
                </div>

                {/* Feed */}
                {loading ? (
                    <div className="ca-simple-empty">Loading posts…</div>
                ) : filteredPosts.length === 0 ? (
                    <div className="ca-simple-empty">No posts found.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {filteredPosts.map(post => (
                            <PostCard
                                key={post.id}
                                post={post}
                                currentUserId={userId}
                                communityNameMap={communityNameMap}
                                onDelete={handleDeletePost}
                                onMakeOffer={handleMakeOffer}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Make Offer Modal */}
            {offerTarget && userId && (
                <MakeOfferModal
                    open={!!offerTarget}
                    onClose={() => setOfferTarget(null)}
                    receiverId={offerTarget.receiverId}
                    receiverName={offerTarget.receiverName}
                    theyHaveForMe={offerTarget.cards}
                />
            )}
        </div>
    );
}

/* ── PostCard ── */
export function PostCard({ post, currentUserId, communityNameMap, onDelete, onMakeOffer }: {
    post: any;
    currentUserId: string | null;
    communityNameMap: Record<number, string>;
    onDelete: (id: string) => void;
    onMakeOffer: (post: any) => void;
}) {
    const [openModal, setOpenModal] = useState<any[] | null>(null);

    const audienceParts: string[] = [];
    if (post.is_public) audienceParts.push('Public');
    if (Array.isArray(post.community_ids)) {
        post.community_ids.forEach((id: number) => {
            const name = communityNameMap[id];
            if (name) audienceParts.push(name);
        });
    }
    const audienceLabel = audienceParts.join(' / ') || 'Unknown';

    // Don't show Make Offer on own posts or posts with no cards
    const canOffer = currentUserId && post.user_id !== currentUserId && post.cards?.length > 0;

    return (
        <div className="ca-post-card">
            {/* Post header */}
            <div className="ca-post-header">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="ca-post-author">
                            {post.display_name || 'Anonymous Collector'}
                        </span>
                        <span className={`ca-post-type-badge ${post.post_type === 'wishlist' ? 'ca-post-type-badge--wishlist' : 'ca-post-type-badge--tradelist'}`}>
                            {post.post_type}
                        </span>
                        {post.cashonly && (
                            <span className="ca-post-cash-badge">
                                Cash only
                            </span>
                        )}
                    </div>
                    <span className="ca-post-audience">{audienceLabel}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Make Offer button */}
                    {canOffer && (
                        <button
                            onClick={() => onMakeOffer(post)}
                            className="ca-make-offer-btn"
                            style={{ padding: '5px 14px' }}
                        >
                            Make Offer
                        </button>
                    )}

                    {currentUserId === post.user_id && (
                        <button
                            onClick={() => onDelete(post.id)}
                            className="ca-close-x"
                        >×</button>
                    )}
                </div>
            </div>

            {/* Content */}
            <p className="ca-post-content" style={{ marginBottom: 0 }}>
                {post.content}
            </p>

            {/* Card previews */}
            {post.cards && post.cards.length > 0 && (
                <>
                    <div
                        className="ca-post-preview-row"
                        onClick={() => setOpenModal(post.cards)}
                    >
                        {post.cards.slice(0, 5).map((card: any, i: number) => (
                            <div
                                key={i}
                                className="ca-post-preview-tile"
                            >
                                <img
                                    src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
                                    alt={card.tcgplayer_name}
                                    className="ca-post-preview-img"
                                />
                                <span className="ca-post-preview-name">
                                    {card.tcgplayer_name}
                                </span>
                                {card.price != null && (
                                    <span className="ca-post-preview-price">
                                        ${parseFloat(card.price).toFixed(2)}
                                    </span>
                                )}
                            </div>
                        ))}

                        {post.cards.length > 5 && (
                            <div className="ca-post-preview-more">
                                +{post.cards.length - 5}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Full cards modal */}
            {openModal && (
                <div
                    onClick={() => setOpenModal(null)}
                    className="ca-modal-overlay"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="ca-post-fullmodal"
                    >
                        <div className="ca-post-fullmodal-grid">
                            {openModal.map((card, i) => (
                                <div key={i} className="ca-post-fullmodal-item">
                                    <img
                                        src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
                                        alt={card.tcgplayer_name}
                                        className="ca-post-fullmodal-img"
                                    />
                                    {card.price != null && (
                                        <span className="ca-post-fullmodal-price">
                                            ${parseFloat(card.price).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
