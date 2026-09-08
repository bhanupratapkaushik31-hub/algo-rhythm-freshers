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

    // 3. Fetch entries to compute metrics
    let entries: any[] = [];
    const { data: entriesWithCoord, error: entriesErr } = await supabaseAdmin
      .from('entries')
      .select('coordinator_id, scanned_by, entry_time, scanned_at, is_test');

    if (entriesErr) {
      console.warn('Fetch entries with coordinator_id/is_test failed, trying legacy fallback:', entriesErr.message);
      const { data: entriesFallback, error: fallbackErr } = await supabaseAdmin
        .from('entries')
        .select('scanned_by, entry_time, scanned_at');

      if (!fallbackErr && entriesFallback) {
        entries = entriesFallback.map((e: any) => ({ ...e, coordinator_id: null }));
      }
    } else {
      entries = entriesWithCoord || [];
    }

    // 4. Fetch test QR scan history from settings
    let testScans: any[] = [];
    try {
      const { data: testSetting } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'admin_test_qr_scans')
        .maybeSingle();

      if (testSetting?.value && Array.isArray((testSetting.value as any).scans)) {
        testScans = (testSetting.value as any).scans;
      }
    } catch (err) {
      console.warn('Fetch admin_test_qr_scans setting note:', err);
    }

    // Map metrics for each coordinator
    const data = (coordinators || []).map((c: any) => {
      const cEmail = (c.email || '').toLowerCase().trim();
      const cName = (c.name || '').toLowerCase().trim();
      const cId = c.id ? String(c.id) : '';

      // Find live entries scanned by this coordinator (using ID or Email or Name)
      const liveScans = (entries || []).filter((e: any) => {
        if (e.is_test) return false;
        if (cId && e.coordinator_id && String(e.coordinator_id) === cId) return true;
        const scannedBy = (e.scanned_by || '').toLowerCase().trim();
        if (cEmail && scannedBy.includes(cEmail)) return true;
        if (cName && scannedBy.includes(cName)) return true;
        return false;
      });

      // Find test scans performed by this coordinator
      const coordTestScans = testScans.filter((s: any) => {
        if (cId && s.coordinator_id && String(s.coordinator_id) === cId) return true;
        const sEmail = (s.coordinator_email || '').toLowerCase().trim();
        const sName = (s.coordinator_name || '').toLowerCase().trim();
        if (cEmail && sEmail === cEmail) return true;
        if (cName && sName === cName) return true;
        return false;
      });

      const liveCount = liveScans.length;
      const testCount = coordTestScans.length;
      const totalScans = liveCount + testCount;
      
      // Calculate last scan timestamp from all scans
      const allTimes: number[] = [];
      liveScans.forEach((s: any) => {
        const t = new Date(s.entry_time || s.scanned_at).getTime();
        if (!isNaN(t)) allTimes.push(t);
      });
      coordTestScans.forEach((s: any) => {
        const t = new Date(s.scanned_at).getTime();
        if (!isNaN(t)) allTimes.push(t);
      });

      const lastScanTime = allTimes.length > 0 ? new Date(Math.max(...allTimes)).toISOString() : null;

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        role: c.role,
        active: c.active !== false,
        created_at: c.created_at,
        total_scans: totalScans, // successful scans (live + test)
        successful_entries: liveCount,
        test_scans: testCount,
        duplicate_attempts: 0,
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
