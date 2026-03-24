export interface Session {
  sub: string; // your internal user UUID
  facebook_id?: string | null;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
}

const TOKEN_KEY = 'bts_token';

export function saveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    // Remove old keys from the previous implementation too
    localStorage.removeItem('bts_logged_in');
    localStorage.removeItem('bts_profile');
  } catch {}
}

/**
 * Decode the JWT payload without verifying the signature.
 * Signature verification happens server-side on protected API routes.
 * This is safe for reading display data (name, avatar) client-side.
 */
export function decodeSession(token: string): Session | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (!decoded.sub) return null;
    return decoded as Session;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  const token = getToken();
  if (!token) return null;
  return decodeSession(token);
}

export function isTokenExpired(token: string): boolean {
  try {
    const session = decodeSession(token);
    if (!session) return true;
    const { exp } = session as any;
    if (!exp) return false;
    return Date.now() / 1000 > exp;
  } catch {
    return true;
  }
}
