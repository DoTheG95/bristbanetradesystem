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

interface ExportRow {
    username: string;
    tcgplayer_name: string;
    card_number: string;
    quantity: string;
    tcgplayer_id: string;
}

function downloadCSV(filename: string, rows: ExportRow[]) {
    const header = ['Username', 'Card Name', 'Card Number', 'Quantity'];
    const lines  = [
        header.map(h => `"${h}"`).join(','),
        ...rows.map(r => [r.username, r.tcgplayer_name, r.card_number, r.quantity]
            .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

export default function LocalArea() {
    const [communities, setCommunities]               = useState<Community[]>([]);
    const [selectedCommunity, setSelectedCommunity]   = useState<string>('');
    const [showCommunityModal, setShowCommunityModal] = useState(false);
    const [showJoinModal, setShowJoinModal]           = useState(false);
    const [loading, setLoading]                       = useState(true);
    const [userId, setUserId]                         = useState<string | null>(null);
    const [displayName, setDisplayName]               = useState<string | null>(null);
    const [posts, setPosts]                           = useState<any[]>([]);
    const [postsLoading, setPostsLoading]             = useState(false);
    const [codeCopied, setCodeCopied]                 = useState(false);

    // Export preview state
    const [exportPreview, setExportPreview] = useState<{
        listType: 'wishlist' | 'tradelist';
        rows: ExportRow[];
        communityName: string;
    } | null>(null);
    const [exportLoading, setExportLoading] = useState<'wishlist' | 'tradelist' | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) return window.location.replace('/');
            setUserId(session.user.id);
            const { data: profile } = await supabase
                .from('profiles').select('display_name').eq('id', session.user.id).single();
            setDisplayName(profile?.display_name ?? null);
            await fetchUserCommunityIds(session.user.id);
        });
    }, []);

    useEffect(() => {
        if (!selectedCommunity) return;
        fetchCommunityPosts(selectedCommunity);
    }, [selectedCommunity]);

    const fetchUserCommunityIds = useCallback(async (uid: string) => {
        const { data, error } = await supabase
            .from('user_communities').select('community_id').eq('user_id', uid);
        if (error) { console.error(error); setLoading(false); return; }
        const ids = (data ?? []).map((r: any) => r.community_id);
        if (ids.length > 0) await fetchCommunities(ids);
        else setLoading(false);
    }, []);

    const fetchCommunities = async (ids: string[]) => {
        const { data, error } = await supabase
            .from('communities').select('id, name, description').in('id', ids);
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
            .from('posts').select('*')
            .contains('community_ids', [communityId])
            .order('created_at', { ascending: false });
        if (error) console.error('Error fetching community posts:', error.message);
        setPosts(data ?? []);
        setPostsLoading(false);
    }, []);

    const handleCopyCommunityCode = useCallback(async () => {
        if (!selectedCommunity) return;
        try {
            const { data: community, error } = await supabase
                .from('communities').select('access_code').eq('id', selectedCommunity).single();
            if (error) throw error;
            if (!community?.access_code) return;
            await navigator.clipboard.writeText(community.access_code);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    }, [selectedCommunity]);

    /* ── Load export data → show preview modal ── */
    const handleExport = useCallback(async (listType: 'wishlist' | 'tradelist') => {
        if (!selectedCommunity) return;
        setExportLoading(listType);

        try {
            const { data: members, error: memberErr } = await supabase
                .from('user_communities').select('user_id').eq('community_id', selectedCommunity);
            if (memberErr) throw memberErr;

            const memberIds = (members ?? []).map((m: any) => m.user_id);
            if (memberIds.length === 0) { alert('No members found.'); return; }

            const { data: profiles, error: profileErr } = await supabase
                .from('profiles').select('id, display_name').in('id', memberIds);
            if (profileErr) throw profileErr;

            const nameMap: Record<string, string> = Object.fromEntries(
                (profiles ?? []).map((p: any) => [p.id, p.display_name ?? 'Unknown'])
            );

            const { data: cards, error: cardErr } = await supabase
                .from('user_cards')
                .select('user_id, tcgplayer_id, tcgplayer_name, card_number, quantity, price')
                .eq('list_type', listType)
                .in('user_id', memberIds);
            if (cardErr) throw cardErr;

            if (!cards || cards.length === 0) {
                alert(`No ${listType} items found for this community.`);
                return;
            }

            const rows: ExportRow[] = [...cards]
                .sort((a, b) => {
                    const na = nameMap[a.user_id] ?? '';
                    const nb = nameMap[b.user_id] ?? '';
                    if (na !== nb) return na.localeCompare(nb);
                    return (a.tcgplayer_name ?? '').localeCompare(b.tcgplayer_name ?? '');
                })
                .map(c => ({
                    username:       nameMap[c.user_id] ?? 'Unknown',
                    tcgplayer_name: c.tcgplayer_name ?? '',
                    card_number:    c.card_number ?? '',
                    quantity:       c.quantity != null ? String(c.quantity) : '—',
                    tcgplayer_id:   String(c.tcgplayer_id ?? ''),
                }));

            const communityName = communities.find(c => c.id.toString() === selectedCommunity)?.name ?? 'community';
            setExportPreview({ listType, rows, communityName });

        } catch (err: any) {
            console.error('Export error:', err);
            alert('Failed to load data. Please try again.');
        } finally {
            setExportLoading(null);
        }
    }, [selectedCommunity, communities]);

    const handleDownloadCSV = useCallback(() => {
        if (!exportPreview) return;
        const dateStr  = new Date().toISOString().split('T')[0];
        const filename = `${exportPreview.communityName}-${exportPreview.listType}-${dateStr}.csv`;
        downloadCSV(filename, exportPreview.rows);
    }, [exportPreview]);

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

    const currentCommunity            = communities.find(c => c.id.toString() === selectedCommunity);
    const currentCommunityDescription = currentCommunity?.description ?? 'No description available.';

    // Group preview rows by username for display
    const groupedPreview = exportPreview
        ? exportPreview.rows.reduce<Record<string, ExportRow[]>>((acc, row) => {
            if (!acc[row.username]) acc[row.username] = [];
            acc[row.username].push(row);
            return acc;
          }, {})
        : {};

    return (
        <div style={{ minHeight: '100vh', background: '#0c0c0e', color: '#e8e6e0', fontFamily: 'sans-serif' }}>
            <Navbar />
            <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 20px' }}>
                <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Your Local Communities</h1>
                <p style={{ color: '#666', fontSize: 14, marginBottom: 32 }}>
                    Join or create a community to trade and connect with people nearby.
                </p>

                <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                    <button onClick={() => setShowJoinModal(true)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #4f46e5', background: 'transparent', color: '#818cf8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Join a Community
                    </button>
                    <button onClick={() => setShowCommunityModal(true)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        + Create Community
                    </button>
                    {loading ? (
                        <span style={{ color: '#555', fontSize: 13 }}>Loading communities…</span>
                    ) : communities.length === 0 ? (
                        <span style={{ color: '#555', fontSize: 13 }}>You haven't joined any communities yet.</span>
                    ) : (
                        <select value={selectedCommunity} onChange={(e) => setSelectedCommunity(e.target.value)} style={{ background: '#18181e', color: '#818cf8', border: '1px solid #2a2a32', padding: '6px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
                            {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                </div>

                {/* Community info card */}
                <div style={{ background: '#111115', border: '1px solid #1e1e24', borderRadius: 12, overflow: 'hidden', marginBottom: 32, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                            {currentCommunity?.name?.slice(0, 2).toUpperCase() ?? 'C'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>{currentCommunity?.name ?? 'Community'}</div>
                            <div style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.5 }}>{currentCommunityDescription}</div>
                        </div>

                        {/* Action buttons */}
                        {selectedCommunity && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                                <button
                                    onClick={handleCopyCommunityCode}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: '1px solid #2a2a3a', background: '#16161c', color: codeCopied ? '#4ade80' : '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                                >
                                    {codeCopied ? '✓ Copied!' : '⧉ Copy Code'}
                                </button>
                                <button
                                    onClick={() => handleExport('wishlist')}
                                    disabled={exportLoading === 'wishlist'}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: '1px solid #2a2a3a', background: exportLoading === 'wishlist' ? '#1e1e28' : '#16162a', color: exportLoading === 'wishlist' ? '#444' : '#818cf8', fontSize: 11, fontWeight: 600, cursor: exportLoading === 'wishlist' ? 'not-allowed' : 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                                >
                                    {exportLoading === 'wishlist'
                                        ? <span style={{ display: 'inline-block', width: 10, height: 10, border: '1.5px solid #444', borderTopColor: '#818cf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                        : '↓'}
                                    ✦ Wishlist
                                </button>
                                <button
                                    onClick={() => handleExport('tradelist')}
                                    disabled={exportLoading === 'tradelist'}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: '1px solid #2a2a3a', background: exportLoading === 'tradelist' ? '#1e1e28' : '#16162a', color: exportLoading === 'tradelist' ? '#444' : '#4ade80', fontSize: 11, fontWeight: 600, cursor: exportLoading === 'tradelist' ? 'not-allowed' : 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                                >
                                    {exportLoading === 'tradelist'
                                        ? <span style={{ display: 'inline-block', width: 10, height: 10, border: '1.5px solid #444', borderTopColor: '#4ade80', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                        : '↓'}
                                    ⇄ Trade List
                                </button>
                            </div>
                        )}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>Member list</div>
                </div>

                {/* Feed */}
                {!loading && communities.length > 0 && userId && (
                    <>
                        <CreatePostBox userId={userId} displayName={displayName} userCommunities={communities} onPostCreated={() => fetchCommunityPosts(selectedCommunity)} />
                        {postsLoading ? (
                            <div style={{ textAlign: 'center', color: '#444', padding: '40px 0', fontSize: 13 }}>Loading posts…</div>
                        ) : posts.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#333', padding: '40px 0', fontSize: 13 }}>No posts in this community yet.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {posts.map(post => (
                                    <PostCard key={post.id} post={post} currentUserId={userId} communityNameMap={communityNameMap} onDelete={handleDeletePost} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Export Preview Modal ── */}
            {exportPreview && (
                <div
                    onClick={() => setExportPreview(null)}
                    style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', background: '#111115', border: '1px solid #1e1e24', borderRadius: 14, display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', animation: 'modalIn 0.18s ease' }}
                    >
                        {/* Header */}
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e24', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#e8e6e0' }}>
                                    {exportPreview.listType === 'wishlist' ? '✦ Wishlist' : '⇄ Trade List'} — {exportPreview.communityName}
                                </h2>
                                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#555' }}>
                                    {exportPreview.rows.length} card{exportPreview.rows.length !== 1 ? 's' : ''} across {Object.keys(groupedPreview).length} member{Object.keys(groupedPreview).length !== 1 ? 's' : ''}
                                </p>
                            </div>
                            <button onClick={() => setExportPreview(null)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #2a2a32', background: 'transparent', color: '#555', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        </div>

                        {/* Body — grouped by user */}
                        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
                            {Object.entries(groupedPreview).map(([username, rows]) => (
                                <div key={username} style={{ marginBottom: 8 }}>
                                    {/* Username header */}
                                    <div style={{ padding: '8px 20px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                                            background: `hsl(${username.charCodeAt(0) * 7 % 360}, 40%, 18%)`,
                                            border: `1.5px solid hsl(${username.charCodeAt(0) * 7 % 360}, 55%, 32%)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 11, fontWeight: 700,
                                            color: `hsl(${username.charCodeAt(0) * 7 % 360}, 75%, 65%)`,
                                        }}>
                                            {username.charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e6e0' }}>{username}</span>
                                        <span style={{ fontSize: 11, color: '#444' }}>{rows.length} card{rows.length !== 1 ? 's' : ''}</span>
                                    </div>

                                    {/* Cards */}
                                    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {rows.map((row, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#16161c', borderRadius: 6 }}>
                                                <img
                                                    src={`https://tcgplayer-cdn.tcgplayer.com/product/${row.tcgplayer_id}_in_200x200.jpg`}
                                                    alt={row.tcgplayer_name}
                                                    style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 500, color: '#d4d2cc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {row.tcgplayer_name || '—'}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>{row.card_number}</div>
                                                </div>
                                                {row.quantity !== '—' && (
                                                    <span style={{ fontSize: 11, color: '#555', flexShrink: 0 }}>×{row.quantity}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '14px 20px', borderTop: '1px solid #1e1e24', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <button onClick={() => setExportPreview(null)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #2a2a32', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer' }}>
                                Close
                            </button>
                            <button
                                onClick={handleDownloadCSV}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 20px', borderRadius: 7, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                            >
                                ↓ Download CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CommunityModal open={showCommunityModal} onClose={() => setShowCommunityModal(false)} />
            <JoinCommunityModal open={showJoinModal} onClose={() => setShowJoinModal(false)} onJoined={handleJoined} />

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            `}</style>
        </div>
    );
}