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

    // 3. Fetch entries to compute metrics (with fallback for missing coordinator_id column)
    let entries: any[] = [];
    const { data: entriesWithCoord, error: entriesErr } = await supabaseAdmin
      .from('entries')
      .select('coordinator_id, scanned_by, entry_time')
      .eq('is_test', false);

    if (entriesErr) {
      console.warn('Fetch entries with coordinator_id failed, trying fallback:', entriesErr.message);
      const { data: entriesFallback, error: fallbackErr } = await supabaseAdmin
        .from('entries')
        .select('scanned_by, entry_time')
        .eq('is_test', false);

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

    // 2. Create Auth User in Supabase Auth
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authErr || !authUser.user) {
      console.error('Create auth user error:', authErr);
      return NextResponse.json({
        success: false,
        error: { code: 'AUTH_CREATION_FAILED', message: authErr?.message || 'Failed to register authentication credentials.' }
      }, { status: 400 });
    }

    // 3. Create Admin profile in admins table
    const { data: newProfile, error: profileErr } = await supabaseAdmin
      .from('admins')
      .insert({
        id: authUser.user.id,
        name,
        email,
        role: 'scanner',
        active: true
      })
      .select()
      .single();

    if (profileErr) {
      console.error('Create admin profile error, rolling back auth user:', profileErr);
      // Rollback authentication user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      
      return NextResponse.json({
        success: false,
        error: { code: 'PROFILE_CREATION_FAILED', message: 'Failed to save profile in admins table.' }
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
