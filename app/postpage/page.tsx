'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SearchModal from '../main/SearchModal'; // Keeping your existing modal logic

export default function CommunityPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  // Form State
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('tradelist'); // Matches <option> exactly
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return window.location.replace('/');
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', session.user.id).single();
      setUserId(session.user.id);
      setDisplayName(profile?.display_name);
      fetchPosts();
    });
  }, []);

const handleCreatePost = async () => {
    if (!content.trim() || !userId) return;
    setSubmitting(true);

    try {
        const cardSnapshot = selectedCards.map(c => ({
            tcgplayer_id: String(c.tcgplayer_id),
            tcgplayer_name: c.tcgplayer_name,
            card_number: c.card_number
        }));

        // 1. Insert the Post (Snapshot)
        const { error: postError } = await supabase
            .from('posts')
            .insert({ 
                user_id: userId, 
                display_name: displayName, 
                content, 
                post_type: postType, // 'tradelist' or 'wishlist'
                cards: cardSnapshot 
            });

        if (postError) throw postError;

        // 2. Sync to user_cards (Private Inventory)
        if (selectedCards.length > 0) {
            const userCardRows = selectedCards.map(c => ({
                user_id: userId,
                list_type: postType, // Now matches your 'tradelist'/'wishlist' db logic
                tcgplayer_id: String(c.tcgplayer_id),
                tcgplayer_name: c.tcgplayer_name,
                card_number: c.card_number,
                quantity: 1
            }));

            // This ensures they show up on your Main Page immediately
            await supabase.from('user_cards').upsert(userCardRows, { 
                onConflict: 'user_id,tcgplayer_id,list_type' 
            });
        }

        setContent('');
        setSelectedCards([]);
        fetchPosts();

    } catch (err: any) {
        console.error("Post Error:", err.message);
        // If it still says Check Constraint here, the SQL above didn't run or apply
    } finally {
        setSubmitting(false);
    }
};

    const fetchPosts = async () => {
        setLoading(true);
        // Simple fetch: we get the 'cards' JSON column directly
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (data) setPosts(data);
        setLoading(false);
    };

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0e', color: '#e8e6e0', fontFamily: 'sans-serif' }}>
      <nav style={{ borderBottom: '1px solid #1e1e24', padding: '12px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700 }}>Cardboard Addiction</span>
          <span style={{ fontSize: 13, color: '#888' }}>{displayName}</span>
        </div>
      </nav>

      <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 20px' }}>
        
        {/* ── CREATE POST BOX ── */}
        <div style={{ background: '#111115', border: '1px solid #1e1e24', borderRadius: 12, overflow: 'hidden', marginBottom: 32 }}>
          <div style={{ padding: 16 }}>
            {/* Post Type Dropdown */}
            <select 
              value={postType} 
              onChange={(e) => setPostType(e.target.value)}
              style={{ background: '#18181e', color: '#4f46e5', border: '1px solid #2a2a32', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 12, outline: 'none' }}
            >
              <option value="tradelist">Tradelist</option>
              <option value="wishlist">Wishlist</option>
            </select>

            <textarea
              placeholder="Describe your trade or post details..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{ width: '100%', minHeight: 80, background: 'transparent', border: 'none', color: '#e8e6e0', fontSize: 15, outline: 'none', resize: 'none' }}
            />

            {/* Selected Card Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {selectedCards.map((card, idx) => (
                <div key={idx} style={{ background: '#1e1e28', border: '1px solid #2a2a32', padding: '4px 10px', borderRadius: 6, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#888' }}>{card.card_number}</span> {card.tcgplayer_name}
                  <button onClick={() => setSelectedCards(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', color: '#555', cursor: 'pointer' }}>×</button>
                </div>
              ))}
              <button 
                onClick={() => setShowSearch(true)}
                style={{ background: 'transparent', border: '1px dashed #333', color: '#555', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
              >
                + Add Cards
              </button>
            </div>
          </div>

          <div style={{ padding: '12px 16px', background: '#0e0e12', borderTop: '1px solid #1e1e24', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCreatePost}
              disabled={submitting || !content.trim()}
              style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        {/* ── FEED ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {posts.map((post) => (
            <div key={post.id} style={{ background: '#111115', border: '1px solid #1e1e24', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                {/* ... Header with display_name and post_type ... */}
                
                <p style={{ color: '#d4d2cc', marginBottom: 16 }}>{post.content}</p>

                {/* Display the Snapshot Cards */}
                {post.cards && post.cards.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {post.cards.map((card: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, padding: '4px 8px', background: '#0c0c0e', border: '1px solid #1e1e24', borderRadius: 4, color: '#888' }}>
                        <span style={{ color: '#4f46e5', fontWeight: 600, marginRight: 4 }}>{card.card_number}</span>
                        {card.tcgplayer_name}
                    </div>
                    ))}
            </div>
    )}
  </div>
))}
        </div>
      </div>

      <SearchModal 
        open={showSearch} 
        onClose={() => setShowSearch(false)} 
        onAdd={(cards) => {
          setSelectedCards(prev => [...prev, ...(Array.isArray(cards) ? cards : [cards])]);
          setShowSearch(false);
        }} 
      />
    </div>
  );
}