import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get('authorization');
    const token = auth?.replace('Bearer ', '');
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.sub as string;
  } catch {
    return null;
  }
}

// POST /api/cards — upsert all cards for a list type
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { list_type, cards } = await req.json();

  if (!['wishlist', 'tradelist'].includes(list_type)) {
    return NextResponse.json({ error: 'Invalid list_type' }, { status: 400 });
  }

  if (!Array.isArray(cards)) {
    return NextResponse.json({ error: 'cards must be an array' }, { status: 400 });
  }

  // Step 1 — delete all existing cards for this user + list type
  // then re-insert so we cleanly handle removals too
  const { error: deleteError } = await supabase
    .from('user_cards')
    .delete()
    .eq('user_id', userId)
    .eq('list_type', list_type);

  if (deleteError) {
    console.error('Delete error:', deleteError);
    return NextResponse.json({ error: 'Failed to clear list' }, { status: 500 });
  }

  // Step 2 — insert the current state (skip if empty)
  if (cards.length > 0) {
    const rows = cards.map((c: any) => ({
      user_id:        userId,
      list_type,
      tcgplayer_id:   String(c.tcgplayer_id),
      card_number:    c.card_number ?? null,
      tcgplayer_name: c.tcgplayer_name ?? null,
      quantity:       c.quantity ?? null,
    }));

    const { error: insertError } = await supabase
      .from('user_cards')
      .insert(rows);

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save cards' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, saved: cards.length });
}

// GET /api/cards?list_type=wishlist — fetch a user's list
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const list_type = req.nextUrl.searchParams.get('list_type');

  if (!list_type || !['wishlist', 'tradelist'].includes(list_type)) {
    return NextResponse.json({ error: 'Invalid list_type' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('user_cards')
    .select('id, tcgplayer_id, card_number, tcgplayer_name, quantity')
    .eq('user_id', userId)
    .eq('list_type', list_type)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch list' }, { status: 500 });
  }

  return NextResponse.json({ cards: data });
}

// DELETE /api/cards?list_type=wishlist&tcgplayer_id=123 — remove one card
export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const list_type    = req.nextUrl.searchParams.get('list_type');
  const tcgplayer_id = req.nextUrl.searchParams.get('tcgplayer_id');

  if (!list_type || !tcgplayer_id) {
    return NextResponse.json({ error: 'Missing list_type or tcgplayer_id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_cards')
    .delete()
    .eq('user_id', userId)
    .eq('list_type', list_type)
    .eq('tcgplayer_id', tcgplayer_id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}