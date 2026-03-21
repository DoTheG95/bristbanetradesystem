import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(req: NextRequest) {
  try {
    const { code, redirectUri } = await req.json();

    if (!code || !redirectUri) {
      return NextResponse.json({ error: 'Missing code or redirectUri' }, { status: 400 });
    }

    // 1. Exchange the OAuth code for an access token (server-side, safe)
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `client_id=${process.env.NEXT_PUBLIC_FB_APP_ID}` +
      `&client_secret=${process.env.FB_APP_SECRET}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${code}`
    );

    if (!tokenRes.ok) {
      const err = await tokenRes.json();
      console.error('FB token exchange error:', err);
      return NextResponse.json({ error: 'Failed to exchange Facebook code' }, { status: 401 });
    }

    const { access_token: accessToken } = await tokenRes.json();

    // 2. Fetch the user profile with the access token
    const fbRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,picture.type(large)&access_token=${accessToken}`
    );

    if (!fbRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch Facebook profile' }, { status: 401 });
    }

    const fbUser = await fbRes.json();

    if (fbUser.error || !fbUser.id) {
      return NextResponse.json({ error: 'Could not verify Facebook identity' }, { status: 401 });
    }

    // 3. Upsert into your own users table
    const { data: user, error: dbError } = await supabase
      .from('users')
      .upsert(
        {
          facebook_id: fbUser.id,
          name: fbUser.name ?? null,
          avatar_url: fbUser.picture?.data?.url ?? null,
          last_login: new Date().toISOString(),
        },
        {
          onConflict: 'facebook_id',
          ignoreDuplicates: false,
        }
      )
      .select('id, facebook_id, name, avatar_url, role')
      .single();

    if (dbError || !user) {
      console.error('DB upsert error:', dbError);
      return NextResponse.json({ error: 'Failed to save user' }, { status: 500 });
    }

    // 4. Sign your own JWT
    const token = await new SignJWT({
      sub: user.id,
      facebook_id: user.facebook_id,
      name: user.name,
      avatar_url: user.avatar_url,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(JWT_SECRET);

    return NextResponse.json({ token, user });
  } catch (err) {
    console.error('Facebook auth error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}