import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabaseAdmin';

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'scanner' | 'coordinator';
}

export async function verifyAdminAuth(
  request: NextRequest,
  allowedRoles?: ('super_admin' | 'admin' | 'scanner' | 'coordinator')[]
): Promise<AuthenticatedAdmin | null> {
  let token = '';

  // 1. Try Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Try cookie (Supabase cookie name is often sb-<project-ref>-auth-token or similar)
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    // Look for generic access token cookie we can set manually or standard Supabase cookie
    const tokenMatch = cookieHeader.match(/sb-access-token=([^;]+)/);
    if (tokenMatch) {
      token = tokenMatch[1];
    }
  }

  if (!token) return null;

  try {
    // Verify the token with Supabase Auth
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;

    // Fetch details and role from the custom admins table
    const { data: adminRecord, error: adminErr } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (adminErr || !adminRecord) {
      console.warn(`Auth user ${user.email} not registered in public.admins table.`);
      return null;
    }

    // Active status check
    if (adminRecord.active === false) {
      console.warn(`Auth user ${user.email} is disabled.`);
      return null;
    }

    // Role check (treat 'scanner' and 'coordinator' as identical)
    const normalizedRole = adminRecord.role === 'coordinator' ? 'scanner' : adminRecord.role;
    const normalizedAllowed = allowedRoles?.map(r => r === 'coordinator' ? 'scanner' : r);

    if (allowedRoles && !normalizedAllowed?.includes(normalizedRole as any)) {
      console.warn(`User ${user.email} role '${adminRecord.role}' is not in allowed roles:`, allowedRoles);
      return null;
    }

    return adminRecord as AuthenticatedAdmin;
  } catch (err) {
    console.error('verifyAdminAuth crashed:', err);
    return null;
  }
}
