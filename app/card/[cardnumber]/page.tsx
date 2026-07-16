'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '../../components/Navbar';

interface CardDetail {
  name: string;
  type: string | null;
  id: string;
  level: number | null;
  play_cost: number | null;
  evolution_cost: number | null;
  color: string | null;
  color2: string | null;
  digi_type: string | null;
  digi_type2: string | null;
  form: string | null;
  dp: number | null;
  attribute: string | null;
  rarity: string | null;
  stage: string | null;
  main_effect: string | null;
  source_effect: string | null;
  set_name: string[] | null;
  tcgplayer_name: string;
  tcgplayer_id: number;
}

interface TraderRow {
  userId: string;
  displayName: string;
  digimon: string | null;
  qty: number | null;
  price: number | null;
}

const rarityClass = (rarity: string | null) => rarity ? `ca-rarity-${rarity.toLowerCase()}` : '';

export default function CardPage() {
  const params = useParams();
  const router = useRouter();
  const cardNumber = params?.cardnumber as string;

  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [checking, setChecking]             = useState(true);

  const [card, setCard]                 = useState<CardDetail | null>(null);
  const [cardLoading, setCardLoading]   = useState(true);
  const [cardNotFound, setCardNotFound] = useState(false);

  const [traders, setTraders]             = useState<TraderRow[]>([]);
  const [tradersLoading, setTradersLoading] = useState(true);

  /* ── auth guard ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.replace('/');
        return;
      }
      setLoggedInUserId(session.user.id);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        window.location.replace('/');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ── load card details from the Digimon TCG API ── */
  useEffect(() => {
    if (checking || !cardNumber) return;
    const controller = new AbortController();

    const loadCard = async () => {
      setCardLoading(true);
      setCardNotFound(false);
      try {
        const url = new URL('https://digimoncard.io/api-public/search');
        url.searchParams.append('card', cardNumber);
        const res = await fetch(url.toString(), { signal: controller.signal });
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
          setCardNotFound(true);
          setCard(null);
        } else {
          const exact = data.find((c: any) => String(c.id).toLowerCase() === cardNumber.toLowerCase());
          setCard(exact ?? data[0]);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setCardNotFound(true);
          setCard(null);
        }
      } finally {
        setCardLoading(false);
      }
    };

    loadCard();
    return () => controller.abort();
  }, [checking, cardNumber]);

  /* ── load traders who have this card in their trade list ── */
  useEffect(() => {
    if (checking || !card || !loggedInUserId) return;

    const loadTraders = async () => {
      setTradersLoading(true);
      const { data, error } = await supabase.rpc('find_traders_for_cards', {
        p_tcgplayer_ids: [String(card.tcgplayer_id)],
        p_user_id:       loggedInUserId,
      });

      if (error) {
        console.error('find_traders_for_cards error:', error);
        setTraders([]);
      } else {
        setTraders((data ?? []).map((row: any) => ({
          userId:      row.user_id,
          displayName: row.display_name,
          digimon:     row.digimon ?? null,
          qty:         row.they_have_qty ?? null,
          price:       row.price != null ? parseFloat(String(row.price)) : null,
        })));
      }
      setTradersLoading(false);
    };

    loadTraders();
  }, [checking, card, loggedInUserId]);

  if (checking || !loggedInUserId) return null;

  if (cardLoading) {
    return (
      <div className="ca-page">
        <Navbar />
        <div className="ca-state-message">Loading card…</div>
      </div>
    );
  }

  if (cardNotFound || !card) {
    return (
      <div className="ca-page">
        <Navbar />
        <div className="ca-state-message">Card not found.</div>
      </div>
    );
  }

  const rarity = card.rarity ? card.rarity.toUpperCase() : null;

  const stat = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return null;
    return (
      <div key={label} className="ca-card-stat">
        <div className="ca-card-stat-label">{label}</div>
        <div className="ca-card-stat-value">{value}</div>
      </div>
    );
  };

  return (
    <div className="ca-page">
      <Navbar />

      <div className="ca-container">

        {/* Card header: image left, info right */}
        <div className="ca-card-header">
          <div className="ca-card-image-col">
            <img
              src={`https://tcgplayer-cdn.tcgplayer.com/product/${card.tcgplayer_id}_in_800x800.jpg`}
              alt={card.tcgplayer_name}
              className="ca-card-image"
            />
          </div>

          <div className="ca-card-info-col">
            <h1 className="ca-card-title">
              {card.tcgplayer_name || card.name}
            </h1>
            <div className="ca-card-meta-row">
              <span className="ca-card-number">{card.id}</span>
              {rarity && (
                <span className={`ca-badge-rarity ${rarityClass(rarity)}`}>
                  {rarity}
                </span>
              )}
            </div>

            <div className="ca-card-stat-grid">
              {stat('Type', card.type)}
              {stat('Stage', card.stage)}
              {stat('Form', card.form)}
              {stat('Level', card.level)}
              {stat('DP', card.dp)}
              {stat('Play Cost', card.play_cost)}
              {stat('Evolution Cost', card.evolution_cost)}
              {stat('Attribute', card.attribute)}
              {stat('Color', [card.color, card.color2].filter(Boolean).join(' / '))}
              {stat('Digi-Type', [card.digi_type, card.digi_type2].filter(Boolean).join(' / '))}
            </div>

            {(card.main_effect || card.source_effect) && (
              <div className="ca-card-effect-box">
                {card.main_effect && <p className="ca-card-effect-main">{card.main_effect}</p>}
                {card.source_effect && (
                  <p className={card.main_effect ? 'ca-card-effect-source' : 'ca-card-effect-source ca-card-effect-source--first'}>
                    <em>{card.source_effect}</em>
                  </p>
                )}
              </div>
            )}

            {card.set_name && card.set_name.length > 0 && (
              <div className="ca-card-set-list">
                {card.set_name.map(s => (
                  <span key={s} className="ca-card-set-badge">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Traders section */}
        <div>
          <h2 className="ca-traders-heading">⇄ Traders with this in their trade list</h2>
          <p className="ca-traders-subheading">
            {tradersLoading ? 'Searching…' : `${traders.length} trader${traders.length !== 1 ? 's' : ''} found`}
          </p>

          {tradersLoading ? (
            <div className="ca-panel-message">Loading…</div>
          ) : traders.length === 0 ? (
            <div className="ca-panel-message">Nobody has listed this card in their trade list yet.</div>
          ) : (
            <div className="ca-traders-grid">
              {traders.map(trader => (
                <div
                  key={trader.userId}
                  onClick={() => router.push(`/user/${trader.userId}`)}
                  className="ca-trader-card"
                >
                  <div
                    className="ca-avatar ca-avatar--md"
                    style={{ '--ca-hue': (trader.userId.charCodeAt(0) * 7) % 360 } as React.CSSProperties}
                  >
                    {trader.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="ca-trader-info">
                    <div className="ca-trader-name">{trader.displayName}</div>
                    {trader.digimon && <div className="ca-trader-digimon">{trader.digimon}</div>}
                  </div>
                  <div className="ca-trader-stats">
                    {trader.qty != null && <span className="ca-trader-qty">×{trader.qty}</span>}
                    {trader.price != null && <span className="ca-trader-price">${trader.price.toFixed(2)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
