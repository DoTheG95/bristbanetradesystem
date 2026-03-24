import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}$${derived}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split('$');
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64);
  const storedKey = Buffer.from(key, 'hex');
  if (storedKey.length !== derived.length) return false;
  return timingSafeEqual(storedKey, derived);
}

type UserRow = {
  id: string;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  facebook_id?: string | null;
  password_hash?: string | null;
};

async function signJwt(user: UserRow) {
  return new SignJWT({
    sub: user.id,
    email: user.email ?? null,
    facebook_id: user.facebook_id ?? null,
    name: user.name ?? null,
    avatar_url: user.avatar_url ?? null,
    role: user.role ?? 'user',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

export async function POST(req: NextRequest) {
  try {
    const { mode, email, password, name } = await req.json();

    if (!mode || !['signup', 'login'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (mode === 'signup') {
      const { data: existing, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('email', normalizedEmail)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Supabase users fetch error:', fetchError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      if (existing) {
        return NextResponse.json({ error: 'Email is already registered' }, { status: 409 });
      }

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          email: normalizedEmail,
          password_hash: hashPassword(String(password)),
          name: name ? String(name).trim() : null,
          last_login: new Date().toISOString(),
          role: 'user',
        })
        .select('id, email, name, avatar_url, role, facebook_id')
        .single();

      if (insertError || !newUser) {
        console.error('Supabase user insert error:', insertError);
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
      }

      const token = await signJwt(newUser);
      return NextResponse.json({ token, user: newUser });
    }

    /* login */
    const { data: user, error: fetchUserError } = await supabase
      .from('users')
      .select('id, email, name, avatar_url, role, facebook_id, password_hash')
      .eq('email', normalizedEmail)
      .single();

    if (fetchUserError || !user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.password_hash || !verifyPassword(String(password), user.password_hash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const token = await signJwt(user);
    const responseUser = { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url, role: user.role, facebook_id: user.facebook_id };
    return NextResponse.json({ token, user: responseUser });
  } catch (err) {
    console.error('Email auth error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
