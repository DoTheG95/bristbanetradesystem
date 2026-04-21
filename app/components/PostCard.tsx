'use client';

import React from 'react';


export default function PostCard({ post, currentUserId, communityNameMap, onDelete }: {
    post: any;
    currentUserId: string | null;
    communityNameMap: Record<string, string>;
    onDelete: (id: string) => void;
}) {
    const audienceParts: string[] = [];
    if (post.community_ids === null) audienceParts.push('Public');
    if (Array.isArray(post.community_ids)) {
        post.community_ids.forEach((id: string) => {
            // is public skip
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
            </p>

            {post.cards && post.cards.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 12, borderTop: '1px solid #18181e' }}>
                    {post.cards.map((card: any, i: number) => (
                        <div key={i} style={{ fontSize: 11, padding: '4px 8px', background: '#0c0c0e', border: '1px solid #1e1e24', borderRadius: 4, color: '#888' }}>
                            <span style={{ color: '#4f46e5', fontWeight: 600, marginRight: 4 }}>{card.card_number}</span>
                            {card.tcgplayer_name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}