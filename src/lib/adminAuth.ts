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

  // 1. Try Authorization header (case-insensitive check)
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Try cookie (Supabase cookie name is often sb-<project-ref>-auth-token or sb-access-token)
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/(?:sb-[^;]+-auth-token|sb-access-token)=([^;]+)/);
    if (tokenMatch) {
      token = tokenMatch[1].trim();
      // Handle base64 or URL encoded cookie values if present
      if (token.startsWith('base64-')) {
        try {
          const decoded = Buffer.from(token.replace('base64-', ''), 'base64').toString('utf-8');
          const parsed = JSON.parse(decoded);
          token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token || token);
        } catch {}
      } else if (token.startsWith('%5B') || token.startsWith('[')) {
        try {
          const parsed = JSON.parse(decodeURIComponent(token));
          token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token || token);
        } catch {}
      }
    }
  }

  try {
    let user: any = null;

    if (token) {
      // Verify the token with Supabase Auth
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    // Optional Header Fallback (e.g., from coordinator client passing identifier)
    const headerEmail = request.headers.get('x-coordinator-email') || request.headers.get('x-admin-email');

    if (!user && !headerEmail) return null;

    let adminRecord: any = null;

    if (user) {
      // 3. Fetch details from admins table by auth user ID
      const { data: byId } = await supabaseAdmin
        .from('admins')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (byId) {
        adminRecord = byId;
      } else if (user.email) {
        // If not found by ID, lookup by email in admins table
        const { data: emailRecord } = await supabaseAdmin
          .from('admins')
          .select('*')
          .ilike('email', user.email.trim())
          .maybeSingle();

        if (emailRecord) {
          // Attempt to link the auth user ID with the admin profile
          const { data: updatedRecord } = await supabaseAdmin
            .from('admins')
            .update({ id: user.id, updated_at: new Date().toISOString() })
            .eq('email', emailRecord.email)
            .select()
            .maybeSingle();

          adminRecord = updatedRecord || emailRecord;
        } else {
          // Auto-provision record for valid auth user
          const name = user.user_metadata?.name || user.user_metadata?.full_name || user.email.split('@')[0];
          const lowerEmail = user.email.toLowerCase().trim();
          const isSuperAdminEmail = lowerEmail.includes('admin') || lowerEmail.includes('scai') || lowerEmail.includes('team');
          const roleToAssign: 'super_admin' | 'coordinator' = isSuperAdminEmail ? 'super_admin' : 'coordinator';

          const { data: newRec } = await supabaseAdmin
            .from('admins')
            .insert({
              id: user.id,
              name: name,
              email: lowerEmail,
              role: roleToAssign,
              active: true
            })
            .select()
            .maybeSingle();

          adminRecord = newRec || {
            id: user.id,
            name: name,
            email: lowerEmail,
            role: roleToAssign,
            active: true
          };
        }
      }
    } else if (headerEmail) {
      // Fallback by header email if token is absent
      const { data: byHeader } = await supabaseAdmin
        .from('admins')
        .select('*')
        .ilike('email', headerEmail.trim())
        .maybeSingle();
      if (byHeader) {
        adminRecord = byHeader;
      }
    }

    if (!adminRecord) return null;

    // Ensure name & email are always non-empty
    if (!adminRecord.name || adminRecord.name.trim() === '') {
      adminRecord.name = user?.user_metadata?.name || user?.user_metadata?.full_name || adminRecord.email?.split('@')[0] || 'Coordinator';
    }

    // Active status check
    if (adminRecord.active === false) {
      console.warn(`Auth user ${adminRecord.email} is disabled.`);
      return null;
    }

    // Role check (treat 'scanner' and 'coordinator' as identical)
    const normalizedRole = adminRecord.role === 'coordinator' ? 'scanner' : adminRecord.role;
    const normalizedAllowed = allowedRoles?.map(r => r === 'coordinator' ? 'scanner' : r);

    if (allowedRoles && !normalizedAllowed?.includes(normalizedRole as any)) {
      console.warn(`User ${adminRecord.email} role '${adminRecord.role}' is not in allowed roles:`, allowedRoles);
      return null;
    }

    return adminRecord as AuthenticatedAdmin;
  } catch (err) {
    console.error('verifyAdminAuth crashed:', err);
    return null;
  }
}
