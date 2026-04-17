'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '../components/Navbar';
import CreatePostBox from '../components/CreatePostBox';

interface Community {
    id: number;
    name: string;
}

type FilterMode = 'all' | 'public' | number; // number = community id

export default function PostPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [userCommunities, setUserCommunities] = useState<Community[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

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
            fetchPosts();
        });
    }, []);

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

    // Build a name map for community IDs so PostCard can label them
    const communityNameMap: Record<number, string> = {};
    userCommunities.forEach(c => { communityNameMap[c.id] = c.name; });

    const filteredPosts = posts
        .filter(post => {
            if (filterMode === 'all') return true;
            if (filterMode === 'public') return post.is_public === true;
            // specific community id
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
        <div style={{ minHeight: '100vh', background: '#0c0c0e', color: '#e8e6e0', fontFamily: 'sans-serif' }}>
            <Navbar />

            <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 20px' }}>

                <CreatePostBox
                    userId={userId}
                    displayName={displayName}
                    userCommunities={userCommunities}
                    onPostCreated={fetchPosts}
                />

                {/* ── Filter tabs ── */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                    {(['all', 'public', ...userCommunities.map(c => c.id)] as FilterMode[]).map(mode => {
                        const label = mode === 'all' ? 'All' : mode === 'public' ? 'Public' : userCommunities.find(c => c.id === mode)?.name ?? '';
                        const active = filterMode === mode;
                        return (
                            <button
                                key={String(mode)}
                                onClick={() => setFilterMode(mode)}
                                style={{
                                    padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                                    background: active ? '#1e1e32' : 'transparent',
                                    borderColor: active ? '#4f46e5' : '#2a2a32',
                                    color: active ? '#818cf8' : '#555',
                                }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Search ── */}
                <div style={{ position: 'relative', marginBottom: 20, display: 'flex', alignItems: 'center' }}>
                    <svg style={{ position: 'absolute', left: 10, width: 14, height: 14, color: '#444', flexShrink: 0, pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                        ref={inputRef}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Search posts, cards, or users..."
                        style={{ width: '100%', padding: '9px 36px 9px 32px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 8, color: '#e8e6e0', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                    />
                </div>

                {/* ── Feed ── */}
                {loading ? (
                    <div style={{ textAlign: 'center', color: '#444', padding: '40px 0', fontSize: 13 }}>Loading posts…</div>
                ) : filteredPosts.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#333', padding: '40px 0', fontSize: 13 }}>No posts found.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {filteredPosts.map(post => (
                            <PostCard
                                key={post.id}
                                post={post}
                                currentUserId={userId}
                                communityNameMap={communityNameMap}
                                onDelete={handleDeletePost}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}


/* ── Shared PostCard ── */
export function PostCard({ post, currentUserId, communityNameMap, onDelete }: {
    post: any;
    currentUserId: string | null;
    communityNameMap: Record<number, string>;
    onDelete: (id: string) => void;
}) {
    const [openModal, setOpenModal] = useState<any[] | null>(null);

    // Build the audience label e.g. "Public / Community A / Community B"
    const audienceParts: string[] = [];
    if (post.is_public) audienceParts.push('Public');
    if (Array.isArray(post.community_ids)) {
        post.community_ids.forEach((id: number) => {
            const name = communityNameMap[id];
            if (name) audienceParts.push(name);
        });
    }
    const audienceLabel = audienceParts.join(' / ') || 'Unknown';

    return (
        <div style={{ background: '#111115', border: '1px solid #1e1e24', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#e8e6e0' }}>
                            {post.display_name || 'Anonymous Collector'}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: post.post_type === 'wishlist' ? '#ec4899' : '#4f46e5' }}>
                            {post.post_type}
                        </span>
                        {post.cashonly && (
                            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#22c55e', letterSpacing: '0.05em' }}>
                                Cash only
                            </span>
                        )}
                    </div>
                    {/* Audience label */}
                    <span style={{ fontSize: 11, color: '#555' }}>{audienceLabel}</span>
                </div>

                {currentUserId === post.user_id && (
                    <button
                        onClick={() => onDelete(post.id)}
                        style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#444')}
                    >×</button>
                )}
            </div>

            <p style={{ color: '#d4d2cc', fontSize: 15, lineHeight: 1.5, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
                {post.content}
                <button onClick={() => { setShowMatchResults(false); setOfferTarget(result); }} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }} onMouseEnter={e => (e.currentTarget.style.background = '#6056f5')} onMouseLeave={e => (e.currentTarget.style.background = '#4f46e5')}>
                    Make offer
                </button>
            </p>

            {post.cards && post.cards.length > 0 && (
    <>
        {/* Preview Row */}
        <div
            style={{
                display: 'flex',
                gap: 10,
                overflowX: 'auto',
                paddingTop: 12,
                borderTop: '1px solid #18181e',
                cursor: 'pointer'
            }}
            onClick={() => setOpenModal(post.cards)}
        >
            {post.cards.slice(0, 5).map((card: any, i: number) => (
                <div
                    key={i}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 12px',
                        background: '#0c0c0e',
                        border: '1px solid #1e1e24',
                        borderRadius: 10,
                        color: '#888',
                    }}
                >
                    <img
                        key={i}
                        src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
                        alt={card.tcgplayer_name}
                        style={{
                            width: 80,
                            height: 80,
                            objectFit: 'cover',
                            borderRadius: 8,
                            background: '#111',
                            flexShrink: 0
                        }}
                    />
                <span
                    style={{
                        width: 80,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {card.tcgplayer_name}
                </span>
                </div>
            ))}

            {post.cards.length > 5 && (
                <div
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: 8,
                        background: '#1e1e24',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#888'
                    }}
                >
                    +{post.cards.length - 5}
                </div>
            )}
        </div>
    </>
)}
{openModal && (
    <div
        onClick={() => setOpenModal(null)}
        style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}
    >
        <div
            onClick={(e) => e.stopPropagation()}
            style={{
                background: '#111115',
                padding: 20,
                borderRadius: 12,
                maxWidth: 600,
                width: '90%',
                maxHeight: '80vh',
                overflowY: 'auto'
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                    gap: 12
                }}
            >
                {openModal.map((card, i) => (
                    <img
                        key={i}
                        src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_200x200.jpg`}
                        alt={card.tcgplayer_name}
                        style={{
                            width: '100%',
                            borderRadius: 8
                        }}
                    />
                ))}
            </div>
        </div>
    </div>
)}


        </div>
    );
}