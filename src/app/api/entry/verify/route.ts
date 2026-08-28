import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { EVENT_CONFIG } from '@/config/event';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify coordinator access (super_admin, admin, scanner, or coordinator)
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin', 'scanner', 'coordinator']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to verify tickets.' }
      }, { status: 401 });
    }

    const { ticket_token, is_test_mode, scanner_device } = await request.json();
    if (!ticket_token) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Ticket token is required.' }
      }, { status: 400 });
    }

    // Role check: Only super_admin can enable/use TEST MODE
    const isTest = !!is_test_mode;
    if (isTest) {
      if (admin.role !== 'super_admin') {
        return NextResponse.json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only Super Administrators can enable and scan in Test Mode.' }
        }, { status: 403 });
      }
    }

    // 2. Fetch registration matching the secure token
    const { data: reg, error: regErr } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('ticket_token', ticket_token)
      .maybeSingle();

    if (regErr) {
      console.error('Verify entry lookup error:', regErr);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Database query failed.' }
      }, { status: 500 });
    }

    if (!reg) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_TICKET', message: 'INVALID TICKET' }
      }, { status: 404 });
    }

    // Check for cancelled/revoked tickets
    if (reg.registration_status === 'CANCELLED') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'CANCELLED_TICKET',
          message: 'This ticket has been cancelled or refunded.'
        },
        data: { student: reg }
      }, { status: 400 });
    }

    // 3. Verify Payment Status (Must be SUCCESS / PAID)
    if (reg.registration_status !== 'PAID') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNPAID_TICKET',
          message: 'PAYMENT NOT VERIFIED'
        },
        data: { student: reg }
      }, { status: 400 });
    }

    // Generate signed URL for photo if it exists
    const defaultPhotoUrl = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a855f7'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z'/></svg>";
    let photoUrl = defaultPhotoUrl;
    if (reg.photo_path) {
      if (reg.photo_path.startsWith('mock-photos/')) {
        photoUrl = defaultPhotoUrl;
      } else {
        const { data: signedData } = await supabaseAdmin.storage
          .from('student-photos')
          .createSignedUrl(reg.photo_path, 3600);
        photoUrl = signedData?.signedUrl || defaultPhotoUrl;
      }
    }

    const formattedStudent = {
      id: reg.id,
      ticket_id: reg.ticket_id,
      full_name: reg.full_name,
      registration_number: reg.registration_number,
      year: reg.year,
      school_name: reg.school_name,
      modeling: reg.modeling,
      photo_url: photoUrl
    };

    // 4. Check for duplicate scan matching the current mode (Test vs. Live)
    const { data: existingEntry, error: entryErr } = await supabaseAdmin
      .from('entries')
      .select('*')
      .eq('registration_id', reg.id)
      .eq('entry_status', isTest ? 'TEST_ENTERED' : 'ENTERED')
      .maybeSingle();

    if (existingEntry) {
      // Get coordinator details who scanned it originally
      let originalScannedBy = 'Staff';
      if (existingEntry.scanned_by) {
        originalScannedBy = existingEntry.scanned_by;
      }
      
      return NextResponse.json({
        success: true,
        data: {
          status: 'ALREADY_ENTERED',
          student: formattedStudent,
          is_test: isTest,
          entry_details: {
            entry_time: existingEntry.entry_time || existingEntry.scanned_at,
            scanned_by: originalScannedBy,
            scanner_device: existingEntry.scanner_device || 'Web Browser'
          }
        }
      });
    }

    // 5. Date validation (Only enforced in LIVE MODE)
    if (!isTest) {
      const eventTime = new Date(EVENT_CONFIG.date).getTime();
      const entryOpenTime = eventTime - (3 * 60 * 60 * 1000); // 3 hours before start time
      const currentTime = Date.now();

      if (currentTime < entryOpenTime) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'EVENT_NOT_ACTIVE',
            message: 'EVENT NOT ACTIVE — LIVE MODE'
          }
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        status: 'PENDING_CONFIRMATION',
        student: formattedStudent,
        is_test: isTest
      }
    });

  } catch (err: any) {
    console.error('Entry verify API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
