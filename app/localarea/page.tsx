'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '../components/Navbar';
import CommunityModal from '../components/CommunityModal';
import JoinCommunityModal from '../components/JoinCommunityModal';

interface Community {
    id: number;
    name: string;
}

export default function LocalArea() {
    const [communities, setCommunities] = useState<Community[]>([]);
    const [userCommunityIds, setUserCommunityIds] = useState<number[]>([]);
    const [selectedCommunity, setSelectedCommunity] = useState<string>('');
    const [showCommunityModal, setShowCommunityModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const tcgplayerid = '587342';

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) return window.location.replace('/');
            setUserId(session.user.id);
            await fetchUserCommunityIds(session.user.id);
        });
    }, []);

    const fetchUserCommunityIds = async (uid: string) => {
        const { data, error } = await supabase
            .from('user_communities')
            .select('community_id')
            .eq('user_id', uid);

        if (error) {
            console.error('Error fetching user community IDs:', error);
            setLoading(false);
            return;
        }

        const ids = (data ?? []).map((row: { community_id: number }) => row.community_id);
        setUserCommunityIds(ids);

        if (ids.length > 0) {
            await fetchCommunities(ids);
        } else {
            setLoading(false);
        }
    };

    const fetchCommunities = async (ids: number[]) => {
        const { data, error } = await supabase
            .from('communities')
            .select('id, name')
            .in('id', ids);

        if (error) {
            console.error('Error fetching communities:', error);
        } else {
            const fetched = data ?? [];
            setCommunities(fetched);
            if (fetched.length > 0) setSelectedCommunity(String(fetched[0].id));
        }
        setLoading(false);
    };

    // Called by JoinCommunityModal after a successful join to refresh the list
    const handleJoined = async () => {
        if (!userId) return;
        setLoading(true);
        await fetchUserCommunityIds(userId);
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0c0c0e', color: '#e8e6e0', fontFamily: 'sans-serif' }}>
            <Navbar />
            <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 20px' }}>
                <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Your Local Communities</h1>
                <p style={{ color: '#666', fontSize: 14, marginBottom: 32 }}>
                    Join or create a community to trade and connect with people nearby.
                </p>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                    <button
                        onClick={() => setShowJoinModal(true)}
                        style={{
                            padding: '8px 20px',
                            borderRadius: 8,
                            border: '1px solid #4f46e5',
                            background: 'transparent',
                            color: '#818cf8',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Join a Community
                    </button>
                    <button
                        onClick={() => setShowCommunityModal(true)}
                        style={{
                            padding: '8px 20px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#4f46e5',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        + Create Community
                    </button>
                </div>

                {/* Community panel */}
                <div style={{ background: '#111115', border: '1px solid #1e1e24', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e24', display: 'flex', alignItems: 'center', gap: 12 }}>
                        {loading ? (
                            <span style={{ color: '#555', fontSize: 13 }}>Loading communities…</span>
                        ) : communities.length === 0 ? (
                            <span style={{ color: '#555', fontSize: 13 }}>You haven't joined any communities yet.</span>
                        ) : (
                            <select
                                value={selectedCommunity}
                                onChange={(e) => setSelectedCommunity(e.target.value)}
                                style={{
                                    background: '#18181e',
                                    color: '#818cf8',
                                    border: '1px solid #2a2a32',
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    outline: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                {communities.map((c) => (
                                    <option key={c.id} value={String(c.id)}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Placeholder for community content */}
                    <div style={{ padding: 32, textAlign: 'center', color: '#333', fontSize: 13 }}>
                        {!loading && communities.length > 0 ? 'Community feed coming soon…' : null}
                    </div>
                </div>
            </div>

            <CommunityModal
                open={showCommunityModal}
                onClose={() => setShowCommunityModal(false)}
            />
            <JoinCommunityModal
                open={showJoinModal}
                onClose={() => setShowJoinModal(false)}
                onJoined={handleJoined}
            />
        </div>
    );
}