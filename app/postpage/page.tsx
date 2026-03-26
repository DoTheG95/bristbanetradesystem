'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SearchModal from '../components/SearchModal'; // Keeping your existing modal logic
import Navbar from '../components/Navbar';

export default function PostPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [modalText, setModalText] = useState('');

  // Form State
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('tradelist'); // Matches <option> exactly
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [onlyCash, setOnlyCash] = useState(false); // to indicate whether the items in post are only available via cash transaction

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return window.location.replace('/');
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', session.user.id).single();
      setUserId(session.user.id);
      setDisplayName(profile?.display_name);
      fetchPosts();
    });
  }, []);

  const handleSearch = useCallback(() => {
    // search code here
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
              cards: cardSnapshot,
              cashonly: onlyCash,
          });
          
      if (postError) throw postError;

      // 2. Sync to user_cards (Private Inventory)
      if (selectedCards.length > 0) {
        const userCardRows = selectedCards.map(c => ({
            user_id: userId,
            list_type: postType, 
            tcgplayer_id: String(c.id),
            tcgplayer_name: c.tcgplayer_name,
            card_number: c.card_number,
            quantity: null,
        }));

        const { error: syncError } = await supabase
            .from('user_cards')
            .insert(userCardRows); 

        if (syncError) {
            // If the error code is 23505, it just means the card is already in the list.
            if (syncError.code !== '23505') console.error("Sync Error:", syncError.message);
        }
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

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm("Are you sure you want to delete this post?")) return;

        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', postId)
            .eq('user_id', userId); // Safety check to ensure only the owner can delete

        if (error) {
            console.error("Delete Error:", error.message);
        } else {
            fetchPosts(); // Refresh the feed
        }
    };

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0e', color: '#e8e6e0', fontFamily: 'sans-serif' }}>
        <Navbar />

      <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 20px' }}>
        
        {/* ── CREATE POST BOX ── */}
        <div style={{ background: '#111115', border: '1px solid #1e1e24', borderRadius: 12, overflow: 'hidden', marginBottom: 32 }}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Post Type Dropdown */}
              <select 
                value={postType} 
                onChange={(e) => setPostType(e.target.value)}
                style={{ 
                  background: '#18181e', 
                  color: '#4f46e5', 
                  border: '1px solid #2a2a32', 
                  padding: '4px 8px', 
                  borderRadius: 6, 
                  fontSize: 12, 
                  fontWeight: 600, 
                  marginBottom: 12, 
                  outline: 'none' 
                }}
              >
                <option value="tradelist">Tradelist</option>
                <option value="wishlist">Wishlist</option>
              </select>

              {/* Toggle */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginLeft: 12, marginBottom: 12 }}>
                <span style={{ 
                  fontSize: 12, 
                  fontWeight: 600, 
                  color: '#a1a1aa', 
                  marginRight: 8,
                }}>
                  Only Cash
                </span>

                <button
                  onClick={() => setOnlyCash(!onlyCash)}
                  style={{
                    position: 'relative',
                    width: 40,
                    height: 20,
                    borderRadius: 20,
                    border: '1px solid #2a2a32',
                    background: onlyCash ? '#22c55e' : '#3f3f46',
                    transition: 'background 0.2s ease',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: onlyCash ? 20 : 2,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#ffffff',
                      transition: 'left 0.2s ease'
                    }}
                  />
                </button>
              </div>
            </div>
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

        {/* ── POSTS FILTER ── */}
        <div>
            {/* search input */}
            <div style={{ position: 'relative', padding: '0px 0px 9px', display: 'flex', alignItems: 'center' }}>
              <svg style={{ position: 'absolute', left: 10, width: 14, height: 14, color: '#444', flexShrink: 0, pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef}
                value={modalText}
                onChange={(e) => { setModalText(e.target.value); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                aria-label="Add search input"
                placeholder="Type to search..."
                style={{ width: '100%', padding: '9px 36px 9px 32px', background: '#18181e', border: '1px solid #2a2a32', borderRadius: 8, color: '#e8e6e0', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
        </div>

        {/* ── FEED ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {posts.map((post) => (
            <div key={post.id} style={{ background: '#111115', border: '1px solid #1e1e24', borderRadius: 12, padding: 20 }}>
              
              {/* Post Header: Name & Delete */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e8e6e0' }}>
                    {post.display_name || 'Anonymous Collector'}
                  </span>
                  <span style={{ 
                    fontSize: 10, 
                    fontWeight: 800, 
                    textTransform: 'uppercase', 
                    color: post.post_type === 'wishlist' ? '#ec4899' : '#4f46e5',
                    letterSpacing: '0.05em'
                  }}>
                    {post.post_type}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
                  <span style={{ 
                    display: post.cashonly ? 'inline' : 'none',
                    fontSize: 10, 
                    fontWeight: 800, 
                    textTransform: 'uppercase', 
                    color: '#22c55e',
                    letterSpacing: '0.05em'
                  }}>
                    Cash transaction
                  </span>
                </div>

                {/* Show Delete Button only if current user is the author */}
                {userId === post.user_id && (
                  <button 
                    onClick={() => handleDeletePost(post.id)}
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: '#444', 
                      cursor: 'pointer', 
                      fontSize: 18,
                      padding: '0 4px'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#444')}
                  >
                    ×
                  </button>
                )}
              </div>
                
              <p style={{ color: '#d4d2cc', fontSize: 15, lineHeight: 1.5, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
                {post.content}
              </p>

              {/* Display the Snapshot Cards */}
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