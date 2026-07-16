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
    // Store selected community as number (matches communities.id type)
    const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);
    const [showCommunityModal, setShowCommunityModal] = useState(false);
    const [showJoinModal, setShowJoinModal]           = useState(false);
    const [loading, setLoading]                       = useState(true);
    const [userId, setUserId]                         = useState<string | null>(null);
    const [displayName, setDisplayName]               = useState<string | null>(null);
    const [posts, setPosts]                           = useState<any[]>([]);
    const [postsLoading, setPostsLoading]             = useState(false);
    const [codeCopied, setCodeCopied]                 = useState(false);
    const [blockedIds, setBlockedIds]                 = useState<Set<string>>(new Set());

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
            await fetchBlockedIds(session.user.id);
        });
    }, []);

    const fetchBlockedIds = async (uid: string) => {
        const { data } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', uid);
        setBlockedIds(new Set((data ?? []).map((r: any) => r.blocked_id)));
    };

    useEffect(() => {
        if (selectedCommunityId == null) return;
        fetchCommunityPosts(selectedCommunityId);
    }, [selectedCommunityId]);

    const fetchUserCommunityIds = useCallback(async (uid: string) => {
        const { data, error } = await supabase
            .from('user_communities').select('community_id').eq('user_id', uid);
        if (error) { console.error(error); setLoading(false); return; }
        const ids = (data ?? []).map((r: any) => r.community_id);
        if (ids.length > 0) await fetchCommunities(ids);
        else setLoading(false);
    }, []);

    const fetchCommunities = async (ids: number[]) => {
        const { data, error } = await supabase
            .from('communities').select('id, name, description').in('id', ids);
        if (error) { console.error(error); }
        else {
            const fetched = (data ?? []) as Community[];
            setCommunities(fetched);
            if (fetched.length > 0) setSelectedCommunityId(fetched[0].id);
        }
        setLoading(false);
    };

    const fetchCommunityPosts = useCallback(async (communityId: number) => {
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
        if (selectedCommunityId == null) return;
        try {
            const { data: community, error } = await supabase
                .from('communities').select('access_code').eq('id', selectedCommunityId).single();
            if (error) throw error;
            if (!community?.access_code) return;
            await navigator.clipboard.writeText(community.access_code);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    }, [selectedCommunityId]);

    const handleExport = useCallback(async (listType: 'wishlist' | 'tradelist') => {
        if (selectedCommunityId == null) return;
        setExportLoading(listType);

        try {
            const { data: members, error: memberErr } = await supabase
                .from('user_communities').select('user_id').eq('community_id', selectedCommunityId);
            if (memberErr) throw memberErr;

            const memberIds = (members ?? [])
                .map((m: any) => m.user_id)
                .filter((id: string) => id !== userId);
            if (memberIds.length === 0) { alert('No other members found.'); return; }

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

            const communityName = communities.find(c => c.id === selectedCommunityId)?.name ?? 'community';
            setExportPreview({ listType, rows, communityName });

        } catch (err: any) {
            console.error('Export error:', err);
            alert('Failed to load data. Please try again.');
        } finally {
            setExportLoading(null);
        }
    }, [selectedCommunityId, communities]);

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
        else if (selectedCommunityId != null) fetchCommunityPosts(selectedCommunityId);
    };

    const communityNameMap: Record<number, string> = {};
    communities.forEach(c => { communityNameMap[c.id] = c.name; });

    const currentCommunity            = communities.find(c => c.id === selectedCommunityId);
    const currentCommunityDescription = currentCommunity?.description ?? 'No description available.';

    const groupedPreview = exportPreview
        ? exportPreview.rows.reduce<Record<string, ExportRow[]>>((acc, row) => {
            if (!acc[row.username]) acc[row.username] = [];
            acc[row.username].push(row);
            return acc;
          }, {})
        : {};


    const userCommunitiesForPost: Community[] = communities;
    const visiblePosts = posts.filter(p => !blockedIds.has(p.user_id));

    return (
        <div className="ca-page">
            <Navbar />
            <div className="ca-container--narrow">
                <h1 className="ca-page-title-lg">Your Local Communities</h1>
                <p className="ca-page-subtitle-lg">
                    Join or create a community to trade and connect with people nearby.
                </p>

                <div className="ca-actions-row">
                    <button onClick={() => setShowJoinModal(true)} className="ca-btn ca-btn-outline-accent" style={{ padding: '8px 20px' }}>
                        Join a Community
                    </button>
                    <button onClick={() => setShowCommunityModal(true)} className="ca-btn ca-btn-primary" style={{ padding: '8px 20px' }}>
                        + Create Community
                    </button>
                    {loading ? (
                        <span style={{ color: 'var(--ca-text-faint)', fontSize: 13 }}>Loading communities…</span>
                    ) : communities.length === 0 ? (
                        <span style={{ color: 'var(--ca-text-faint)', fontSize: 13 }}>You haven't joined any communities yet.</span>
                    ) : (
                        <select
                            value={selectedCommunityId ?? ''}
                            onChange={e => setSelectedCommunityId(Number(e.target.value))}
                            className="ca-community-select"
                        >
                            {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                </div>

                {/* Community info card */}
                <div className="ca-community-info-card">
                    <div className="ca-community-info-top">
                        <div className="ca-community-avatar">
                            {currentCommunity?.name?.slice(0, 2).toUpperCase() ?? 'C'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="ca-community-name">{currentCommunity?.name ?? 'Community'}</div>
                            <div className="ca-community-desc">{currentCommunityDescription}</div>
                        </div>

                        {selectedCommunityId != null && (
                            <div className="ca-community-actions-col">
                                <button onClick={handleCopyCommunityCode} className={`ca-community-action-btn${codeCopied ? ' ca-community-action-btn--copied' : ''}`}>
                                    {codeCopied ? '✓ Copied!' : '⧉ Copy Code'}
                                </button>
                                <button onClick={() => handleExport('wishlist')} disabled={exportLoading === 'wishlist'} className="ca-community-action-btn ca-community-action-btn--wishlist">
                                    {exportLoading === 'wishlist' ? <span className="ca-spinner ca-spinner--sm" /> : '↓'} ✦ Wishlist
                                </button>
                                <button onClick={() => handleExport('tradelist')} disabled={exportLoading === 'tradelist'} className="ca-community-action-btn ca-community-action-btn--tradelist">
                                    {exportLoading === 'tradelist' ? <span className="ca-spinner ca-spinner--sm" /> : '↓'} ⇄ Trade List
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="ca-community-member-label">Member list</div>
                </div>

                {/* Feed */}
                {!loading && communities.length > 0 && userId && (
                    <>
                        <CreatePostBox
                            userId={userId}
                            displayName={displayName}
                            userCommunities={userCommunitiesForPost}
                            onPostCreated={() => selectedCommunityId != null && fetchCommunityPosts(selectedCommunityId)}
                            currentCommunityId={selectedCommunityId}
                        />
                        {postsLoading ? (
                            <div className="ca-simple-empty">Loading posts…</div>
                        ) : visiblePosts.length === 0 ? (
                            <div className="ca-simple-empty">No posts in this community yet.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {visiblePosts.map(post => (
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

            {/* Export Preview Modal */}
            {exportPreview && (
                <div onClick={() => setExportPreview(null)} className="ca-modal-overlay">
                    <div onClick={e => e.stopPropagation()} className="ca-modal ca-modal--lg ca-modal--max-h-85">
                        <div className="ca-modal-header">
                            <div>
                                <h2 className="ca-modal-title">
                                    {exportPreview.listType === 'wishlist' ? '✦ Wishlist' : '⇄ Trade List'} — {exportPreview.communityName}
                                </h2>
                                <p className="ca-modal-subtitle">
                                    {exportPreview.rows.length} card{exportPreview.rows.length !== 1 ? 's' : ''} across {Object.keys(groupedPreview).length} member{Object.keys(groupedPreview).length !== 1 ? 's' : ''}
                                </p>
                            </div>
                            <button onClick={() => setExportPreview(null)} className="ca-icon-btn">×</button>
                        </div>
                        <div className="ca-modal-body--list">
                            {Object.entries(groupedPreview).map(([username, rows]) => (
                                <div key={username} style={{ marginBottom: 8 }}>
                                    <div className="ca-export-member-header">
                                        <div
                                            className="ca-avatar ca-avatar--sm"
                                            style={{ '--ca-hue': (username.charCodeAt(0) * 7) % 360 } as React.CSSProperties}
                                        >
                                            {username.charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ca-text)' }}>{username}</span>
                                        <span style={{ fontSize: 11, color: 'var(--ca-text-ghost)' }}>{rows.length} card{rows.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="ca-export-rows">
                                        {rows.map((row, i) => (
                                            <div key={i} className="ca-mini-card-row">
                                                <img src={`https://tcgplayer-cdn.tcgplayer.com/product/${row.tcgplayer_id}_in_200x200.jpg`} alt={row.tcgplayer_name} className="ca-mini-card-thumb" />
                                                <div className="ca-mini-card-info">
                                                    <div className="ca-mini-card-name">{row.tcgplayer_name || '—'}</div>
                                                    <div className="ca-mini-card-number">{row.card_number}</div>
                                                </div>
                                                {row.quantity !== '—' && <span className="ca-mini-card-qty">×{row.quantity}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="ca-modal-footer">
                            <button onClick={() => setExportPreview(null)} className="ca-btn ca-btn-ghost ca-btn-md">Close</button>
                            <button onClick={handleDownloadCSV} className="ca-btn ca-btn-primary ca-btn-md" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>↓ Download CSV</button>
                        </div>
                    </div>
                </div>
            )}

            <CommunityModal open={showCommunityModal} onClose={() => setShowCommunityModal(false)} />
            <JoinCommunityModal open={showJoinModal} onClose={() => setShowJoinModal(false)} onJoined={handleJoined} />
        </div>
    );
}
