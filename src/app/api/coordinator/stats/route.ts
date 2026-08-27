import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    // 1. Verify coordinator access (either admin, super_admin, or scanner)
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin', 'scanner']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to view coordinator stats.' }
      }, { status: 401 });
    }

    // 2. Query entries scanned by this coordinator (matching by ID or email)
    const { data: entries, error: entryErr } = await supabaseAdmin
      .from('entries')
      .select('*')
      .or(`coordinator_id.eq.${admin.id},scanned_by.eq.${admin.email}`)
      .order('entry_time', { ascending: false });

    if (entryErr) {
      console.error('Fetch coordinator scans DB error:', entryErr);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to retrieve entry logs.' }
      }, { status: 500 });
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          total_scans: 0,
          recent_scans: []
        }
      });
    }

    // 3. Fetch registration details matching these entries to show details
    const regIds = entries.map((e: any) => e.registration_id);
    const { data: registrations, error: regErr } = await supabaseAdmin
      .from('registrations')
      .select('id, full_name, registration_number, year, ticket_id')
      .in('id', regIds);

    if (regErr) {
      console.error('Fetch scan details DB error:', regErr);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to retrieve attendee metadata.' }
      }, { status: 500 });
    }

    // Map details together
    const recentScans = entries.map((e: any) => {
      const reg = (registrations || []).find((r: any) => r.id === e.registration_id);
      return {
        id: e.id,
        entry_time: e.entry_time,
        student_name: reg?.full_name || 'Unknown Student',
        registration_number: reg?.registration_number || 'N/A',
        year: reg?.year || 'N/A',
        ticket_id: reg?.ticket_id || 'N/A'
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        total_scans: entries.length,
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
