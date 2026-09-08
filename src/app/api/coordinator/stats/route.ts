import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    // 1. Verify coordinator access (super_admin, admin, scanner, or coordinator)
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin', 'scanner', 'coordinator']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to view coordinator stats.' }
      }, { status: 401 });
    }

    // 2. Query entries scanned by this coordinator (matching by ID or email or name)
    let entries: any[] = [];
    let entryErr: any = null;

    const { searchParams } = new URL(request.url);
    const isTestParam = searchParams.get('is_test') === 'true';

    const { data: primaryEntries, error: primaryErr } = await supabaseAdmin
      .from('entries')
      .select('*')
      .or(`coordinator_id.eq.${admin.id},scanned_by.ilike.%${admin.email}%`)
      .eq('is_test', isTestParam)
      .order('entry_time', { ascending: false });

    if (primaryErr) {
      console.warn('Fetch coordinator stats with is_test failed, trying fallback:', primaryErr.message);
      const { data: fallbackEntries, error: fallbackErr } = await supabaseAdmin
        .from('entries')
        .select('*')
        .ilike('scanned_by', `%${admin.email}%`)
        .order('entry_time', { ascending: false });

      if (fallbackErr) {
        entryErr = fallbackErr;
      } else {
        entries = fallbackEntries || [];
      }
    } else {
      entries = primaryEntries || [];
    }

    // 3. Query test scans from settings table
    let testScansForCoord: any[] = [];
    try {
      const { data: testSetting } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'admin_test_qr_scans')
        .maybeSingle();

      if (testSetting?.value && Array.isArray((testSetting.value as any).scans)) {
        const allTestScans = (testSetting.value as any).scans;
        testScansForCoord = allTestScans.filter((s: any) => 
          (s.coordinator_id && String(s.coordinator_id) === String(admin.id)) ||
          (s.coordinator_email && s.coordinator_email.toLowerCase() === admin.email.toLowerCase()) ||
          (s.coordinator_name && admin.name && s.coordinator_name.toLowerCase() === admin.name.toLowerCase())
        );
      }
    } catch (testErr) {
      console.warn('Test scans fetch note in coordinator stats:', testErr);
    }

    const totalScansCombined = entries.length + testScansForCoord.length;

    if (entries.length === 0 && testScansForCoord.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          total_scans: 0,
          recent_scans: []
        }
      });
    }

    // 4. Fetch registration details matching live entries to show details
    const regIds = entries.map((e: any) => e.registration_id).filter(Boolean);
    let registrations: any[] = [];

    if (regIds.length > 0) {
      const { data: regData } = await supabaseAdmin
        .from('registrations')
        .select('id, full_name, registration_number, year, ticket_id')
        .in('id', regIds);
      registrations = regData || [];
    }

    // Map live entry details
    const recentScans = entries.map((e: any) => {
      const reg = registrations.find((r: any) => r.id === e.registration_id);
      return {
        id: e.id,
        entry_time: e.entry_time,
        student_name: reg?.full_name || 'Attendee Check-in',
        registration_number: reg?.registration_number || 'N/A',
        year: reg?.year || 'N/A',
        ticket_id: reg?.ticket_id || 'N/A'
      };
    });

    // Also include test scans in recent history if recentScans has space
    testScansForCoord.slice(0, 10).forEach((ts: any) => {
      recentScans.push({
        id: ts.id,
        entry_time: ts.scanned_at,
        student_name: 'Admin Test QR Verified',
        registration_number: 'ADMIN-TEST',
        year: '4th Year',
        ticket_id: 'ALGO26-ADMIN-TEST'
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        total_scans: totalScansCombined,
        recent_scans: recentScans
      }
    });

  } catch (err: any) {
    console.error('Coordinator stats API error:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
