import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAuthedUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  const token = auth?.replace('Bearer ', '');
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getAdminClient();
  const pseudonym = `deleted_user_${userId.slice(0, 8)}`;

  // Purely personal, live-state data — nobody else's history depends on it,
  // so it's safe to remove outright.
  const cleanupSteps: Array<[string, PromiseLike<{ error: any }>]> = [
    ['user_cards', admin.from('user_cards').delete().eq('user_id', userId)],
    ['posts', admin.from('posts').delete().eq('user_id', userId)],
    ['user_communities', admin.from('user_communities').delete().eq('user_id', userId)],
    ['user_follows', admin.from('user_follows').delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`)],
    ['user_blocks', admin.from('user_blocks').delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)],
  ];

  for (const [label, step] of cleanupSteps) {
    const { error } = await step;
    if (error) console.error(`Account cleanup error [${label}]:`, error);
  }

  // Trades, trade_messages, and notifications are left untouched so the other
  // party's history stays intact. We anonymize the profile row instead of
  // deleting it — every trade/message screen resolves names via a profiles
  // lookup, so scrubbing it here is enough to erase this user's identity
  // everywhere that history is shown.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ display_name: pseudonym, avatar_url: null })
    .eq('id', userId);
  if (profileError) console.error('Account cleanup error [profiles]:', profileError);

  // Disable the login itself rather than deleting the auth user — deleting it
  // would cascade and take the profile (and the trade history pointing at it)
  // down with it. Scrambling the email also frees it up for a future signup.
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    email: `${pseudonym}@deleted.invalid`,
    password: randomBytes(32).toString('hex'),
    ban_duration: '876000h',
  });
  if (banError) {
    console.error('Account delete error [auth.users]:', banError);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
