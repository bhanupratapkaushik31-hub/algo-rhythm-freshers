import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    // 1. Verify admin permissions
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to view coordinator stats.' }
      }, { status: 401 });
    }

    // 2. Fetch all coordinators
    const { data: coordinators, error: coordErr } = await supabaseAdmin
      .from('admins')
      .select('*')
      .in('role', ['scanner', 'coordinator']);

    if (coordErr) {
      console.error('Fetch coordinators DB error:', coordErr);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch coordinator accounts.' }
      }, { status: 500 });
    }

    // 3. Fetch entries to compute metrics (with fallback for missing coordinator_id/is_test columns)
    let entries: any[] = [];
    const { data: entriesWithCoord, error: entriesErr } = await supabaseAdmin
      .from('entries')
      .select('coordinator_id, scanned_by, entry_time')
      .eq('is_test', false);

    if (entriesErr) {
      console.warn('Fetch entries with coordinator_id/is_test failed, trying legacy fallback:', entriesErr.message);
      const { data: entriesFallback, error: fallbackErr } = await supabaseAdmin
        .from('entries')
        .select('scanned_by, entry_time')
        .eq('entry_status', 'ENTERED');

      if (fallbackErr) {
        console.error('Fetch entries fallback DB error:', fallbackErr);
        return NextResponse.json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to retrieve entry logs.' }
        }, { status: 500 });
      }
      entries = (entriesFallback || []).map((e: any) => ({ ...e, coordinator_id: null }));
    } else {
      entries = entriesWithCoord || [];
    }

    // Map metrics for each coordinator
    const data = (coordinators || []).map((c: any) => {
      // Find entries scanned by this coordinator (using ID or Email)
      const scanned = (entries || []).filter((e: any) => 
        e.coordinator_id === c.id || 
        (e.scanned_by && e.scanned_by.toLowerCase() === c.email.toLowerCase())
      );

      const successCount = scanned.length;
      
      // Get last scan time
      let lastScanTime = null;
      if (scanned.length > 0) {
        const times = scanned.map((s: any) => new Date(s.entry_time).getTime());
        lastScanTime = new Date(Math.max(...times)).toISOString();
      }

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        role: c.role,
        active: c.active !== false,
        created_at: c.created_at,
        total_scans: successCount, // successful scans
        successful_entries: successCount,
        duplicate_attempts: 0, // database unique constraint blocks these from being written
        invalid_tickets: 0,
        last_scan_time: lastScanTime
      };
    });

    return NextResponse.json({
      success: true,
      data
    });

  } catch (err: any) {
    console.error('GET coordinators API error:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin permissions
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to create coordinators.' }
      }, { status: 401 });
    }

    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Name, email, and password are required.' }
      }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Create or fetch Auth User in Supabase Auth
    let authUserId: string | null = null;
    let isNewAuthUser = false;

    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true
    });

    if (authUser?.user?.id) {
      authUserId = authUser.user.id;
      isNewAuthUser = true;
    } else if (authErr) {
      console.warn('Create auth user note:', authErr.message);
      // Check if user already exists in auth.users by listing or updating
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuth = listData?.users?.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
      
      if (existingAuth) {
        authUserId = existingAuth.id;
        // Update password for existing auth user
        await supabaseAdmin.auth.admin.updateUserById(existingAuth.id, { password, email_confirm: true });
      } else {
        return NextResponse.json({
          success: false,
          error: { code: 'AUTH_CREATION_FAILED', message: authErr.message || 'Failed to register authentication credentials.' }
        }, { status: 400 });
      }
    }

    if (!authUserId) {
      return NextResponse.json({
        success: false,
        error: { code: 'AUTH_CREATION_FAILED', message: 'Unable to resolve authentication user identifier.' }
      }, { status: 400 });
    }

    // 3. Create or update Admin profile in admins table with fallback role handling
    let newProfile: any = null;
    let profileError: any = null;

    // Attempt 1: role = 'coordinator' with ID
    const { data: p1, error: err1 } = await supabaseAdmin
      .from('admins')
      .upsert({
        id: authUserId,
        name: name.trim(),
        email: normalizedEmail,
        role: 'coordinator',
        active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' })
      .select()
      .maybeSingle();

    if (!err1 && p1) {
      newProfile = p1;
    } else {
      console.warn('Attempt 1 (coordinator role) error:', err1?.message);

      // Attempt 2: role = 'scanner' with ID
      const { data: p2, error: err2 } = await supabaseAdmin
        .from('admins')
        .upsert({
          id: authUserId,
          name: name.trim(),
          email: normalizedEmail,
          role: 'scanner',
          active: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' })
        .select()
        .maybeSingle();

      if (!err2 && p2) {
        newProfile = p2;
      } else {
        console.warn('Attempt 2 (scanner role) error:', err2?.message);

        // Attempt 3: insert without onConflict
        const { data: p3, error: err3 } = await supabaseAdmin
          .from('admins')
          .insert({
            id: authUserId,
            name: name.trim(),
            email: normalizedEmail,
            role: 'coordinator',
            active: true
          })
          .select()
          .maybeSingle();

        if (!err3 && p3) {
          newProfile = p3;
        } else {
          // Attempt 4: insert with scanner role without onConflict
          const { data: p4, error: err4 } = await supabaseAdmin
            .from('admins')
            .insert({
              id: authUserId,
              name: name.trim(),
              email: normalizedEmail,
              role: 'scanner',
              active: true
            })
            .select()
            .maybeSingle();

          if (!err4 && p4) {
            newProfile = p4;
          } else {
            profileError = err4 || err3 || err2 || err1;
          }
        }
      }
    }

    if (profileError && !newProfile) {
      console.error('Create admin profile failed completely:', profileError);
      if (isNewAuthUser && authUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
        } catch (delErr) {
          console.warn('Rollback deleteUser failed:', delErr);
        }
      }

      return NextResponse.json({
        success: false,
        error: { 
          code: 'PROFILE_CREATION_FAILED', 
          message: `Failed to save profile in admins table: ${profileError.message || profileError.details || 'Database constraint violation'}` 
        }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: newProfile
    });

  } catch (err: any) {
    console.error('POST coordinators API error:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
