import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'Email and password are required.' }
      }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.signInWithPassword({
      email: normalizedEmail,
      password: password
    });

    if (authErr || !authData.session || !authData.user) {
      console.warn('Coordinator login auth failed:', authErr?.message);
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: authErr?.message || 'Invalid email or password.' }
      }, { status: 401 });
    }

    // 2. Fetch coordinator profile from admins table
    let { data: adminRecord, error: dbErr } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!adminRecord) {
      const { data: byEmail } = await supabaseAdmin
        .from('admins')
        .select('*')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (byEmail) {
        adminRecord = byEmail;
        // Sync ID if needed
        await supabaseAdmin
          .from('admins')
          .update({ id: authData.user.id, updated_at: new Date().toISOString() })
          .eq('email', byEmail.email);
      }
    }

    if (!adminRecord) {
      // Auto-provision profile for authenticated coordinator
      const name = authData.user.user_metadata?.name || normalizedEmail.split('@')[0];
      
      const { data: createdRecord } = await supabaseAdmin
        .from('admins')
        .insert({
          id: authData.user.id,
          name: name,
          email: normalizedEmail,
          role: 'coordinator',
          active: true
        })
        .select()
        .maybeSingle();

      if (createdRecord) {
        adminRecord = createdRecord;
      } else {
        const { data: createdScanner } = await supabaseAdmin
          .from('admins')
          .insert({
            id: authData.user.id,
            name: name,
            email: normalizedEmail,
            role: 'scanner',
            active: true
          })
          .select()
          .maybeSingle();

        if (createdScanner) {
          adminRecord = createdScanner;
        } else {
          // Fallback in-memory coordinator profile
          adminRecord = {
            id: authData.user.id,
            name: name,
            email: normalizedEmail,
            role: 'coordinator',
            active: true
          };
        }
      }
    }

    // 3. Active status check
    if (adminRecord.active === false) {
      return NextResponse.json({
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'This coordinator account has been disabled by an administrator.' }
      }, { status: 403 });
    }

    // 4. Role check
    const allowedRoles = ['scanner', 'coordinator', 'admin', 'super_admin'];
    if (!allowedRoles.includes(adminRecord.role)) {
      return NextResponse.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied: Only gate entry coordinators can log in.' }
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: {
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_in: authData.session.expires_in,
          user: authData.user
        },
        profile: {
          id: adminRecord.id,
          name: adminRecord.name,
          email: adminRecord.email,
          role: adminRecord.role,
          active: adminRecord.active !== false
        }
      }
    });

  } catch (err: any) {
    console.error('Coordinator login crash:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Server error during login.' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
