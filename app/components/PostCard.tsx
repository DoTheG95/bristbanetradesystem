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
        <div className="ca-post-card">
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

                {currentUserId === post.user_id && (
                    <button
                        onClick={() => onDelete(post.id)}
                        className="ca-close-x"
                    >×</button>
                )}
            </div>

            <p className="ca-post-content">
                {post.content}
            </p>

            {post.cards && post.cards.length > 0 && (
                <div className="ca-post-cards-row">
                    {post.cards.map((card: any, i: number) => (
                        <div key={i} className="ca-post-card-chip">
                            <span className="ca-post-chip-number">{card.card_number}</span>
                            {card.tcgplayer_name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
