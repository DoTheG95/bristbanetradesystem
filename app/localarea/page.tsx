'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '../components/Navbar';
import CommunityModal from '../components/CommunityModal';
import JoinCommunityModal from '../components/JoinCommunityModal';
import CreatePostBox from '../components/CreatePostBox';
import PostCard from '../components/PostCard';

interface Community {
    id: number;
    name: string;
    description?: string;
}

export default function LocalArea() {
    const [communities, setCommunities] = useState<Community[]>([]);
    const [selectedCommunity, setSelectedCommunity] = useState<string>('');
    const [showCommunityModal, setShowCommunityModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [postsLoading, setPostsLoading] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) return window.location.replace('/');
            setUserId(session.user.id);

            const { data: profile } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('id', session.user.id)
                .single();
            setDisplayName(profile?.display_name ?? null);
            await fetchUserCommunityIds(session.user.id);
        });
    }, []);

    useEffect(() => {
        if (!selectedCommunity) return; // guard against empty string
        fetchCommunityPosts(selectedCommunity);
    }, [selectedCommunity]);

    const fetchUserCommunityIds = useCallback(async (uid: string) => {
        const { data, error } = await supabase
            .from('user_communities')
            .select('community_id')
            .eq('user_id', uid);

        if (error) { console.error(error); setLoading(false); return; }

        const ids = (data ?? []).map((r: any) => r.community_id);
        if (ids.length > 0) {
            await fetchCommunities(ids);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUserCommunityDescriptions = useCallback(async (community_id: string) => {
        const { data, error } = await supabase
            .from('communities')
            .select('id, description')
            .eq('id', community_id);

        if (error) { console.error(error); setLoading(false); return; }

        const ids = (data ?? []).map((r: any) => r.description);
        if (ids.length > 0) {
            await fetchCommunities(ids);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchCommunities = async (ids: string[]) => {
        const { data, error } = await supabase
            .from('communities')
            .select('id, name, description')
            .in('id', ids);

        if (error) { console.error(error); }
        else {
            const fetched = data ?? [];
            setCommunities(fetched);
            if (fetched.length > 0) setSelectedCommunity(fetched[0].id.toString());
        }
        setLoading(false);
    };

    const fetchCommunityPosts = useCallback(async (communityId: string) => {
        setPostsLoading(true);
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .contains('community_ids', [communityId])
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching community posts:', error.message);
        setPosts(data ?? []);
        setPostsLoading(false);
    }, []);

    const handleJoined = async () => {
        if (!userId) return;
        setLoading(true);
        await fetchUserCommunityIds(userId);
    };

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm('Are you sure you want to delete this post?')) return;
        const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', userId);
        if (error) console.error('Delete error:', error.message);
        else if (selectedCommunity) fetchCommunityPosts(selectedCommunity);
    };




    const communityNameMap: Record<string, string> = {};
    communities.forEach(c => { communityNameMap[c.id] = c.name; });

    const currentCommunity = communities.find(c => c.id.toString() === selectedCommunity);
    const currentCommunityDescription = currentCommunity?.description ?? 'No description available.';

    return (
        <div style={{ minHeight: '100vh', background: '#0c0c0e', color: '#e8e6e0', fontFamily: 'sans-serif' }}>
            <Navbar />
            <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 20px' }}>
                <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Your Local Communities</h1>
                <p style={{ color: '#666', fontSize: 14, marginBottom: 32 }}>
                    Join or create a community to trade and connect with people nearby.
                </p>

                <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                    <button
                        onClick={() => setShowJoinModal(true)}
                        style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #4f46e5', background: 'transparent', color: '#818cf8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                        Join a Community
                    </button>
                    <button
                        onClick={() => setShowCommunityModal(true)}
                        style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                        + Create Community
                    </button>
                    {loading ? (
                            <span style={{ color: '#555', fontSize: 13 }}>Loading communities…</span>
                        ) : communities.length === 0 ? (
                            <span style={{ color: '#555', fontSize: 13 }}>You haven't joined any communities yet.</span>
                        ) : (
                            <select
                                value={selectedCommunity}
                                onChange={(e) => setSelectedCommunity(e.target.value)}
                                style={{ background: '#18181e', color: '#818cf8', border: '1px solid #2a2a32', padding: '6px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                            >
                                {communities.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}
                </div>

                {/* Community selector */}
                <div style={{ background: '#111115', border: '1px solid #1e1e24', borderRadius: 12, overflow: 'hidden', marginBottom: 32, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontWeight: 700, fontSize: 16 }}>
                            {currentCommunity?.name?.slice(0, 2).toUpperCase() ?? 'C'}
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>{currentCommunity?.name ?? 'Community'}</div>
                            <div style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.5 }}>{currentCommunityDescription}</div>
                        </div>
                        <div>
                            Export icon
                            {/* Export the lists of what users in the community need
                                Structure will be a CSV with username: {cards, qty}
                            */}
                        </div>
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>Member list</div>
                </div>

                {/* Feed */}
                {!loading && communities.length > 0 && userId && (
                    <>
                        <CreatePostBox
                            userId={userId}
                            displayName={displayName}
                            userCommunities={communities}
                            onPostCreated={() => fetchCommunityPosts(selectedCommunity)}
                        />

                        {postsLoading ? (
                            <div style={{ textAlign: 'center', color: '#444', padding: '40px 0', fontSize: 13 }}>Loading posts…</div>
                        ) : posts.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#333', padding: '40px 0', fontSize: 13 }}>No posts in this community yet.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {posts.map(post => (
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
                    </>
                )}
            </div>

            <CommunityModal open={showCommunityModal} onClose={() => setShowCommunityModal(false)} />
            <JoinCommunityModal open={showJoinModal} onClose={() => setShowJoinModal(false)} onJoined={handleJoined} />
        </div>
    );
}