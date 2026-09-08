import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { EVENT_CONFIG } from '@/config/event';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticket_token, is_test_mode, scanner_device } = body;
    if (!ticket_token) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Ticket token is required.' }
      }, { status: 400 });
    }

    // 1. Clean token from any URL or format
    let cleanedToken = String(ticket_token).trim();
    if (cleanedToken.includes('/ticket/')) {
      cleanedToken = cleanedToken.split('/ticket/').pop()?.split('?')[0]?.split('#')[0] || cleanedToken;
    }

    // Special Admin Test QR Handling
    const isAdminTest = cleanedToken.toLowerCase() === 'admin-test' || 
                        cleanedToken.toUpperCase() === 'ALGO26-ADMIN-TEST' || 
                        cleanedToken.toLowerCase().includes('admin-test');

    // 2. Verify coordinator / scanner access
    let admin = await verifyAdminAuth(request, ['super_admin', 'admin', 'scanner', 'coordinator']);

    // Fallback: Check body or headers for coordinator email if token wasn't directly recognized
    if (!admin) {
      const fallbackEmail = body.coordinator_email || request.headers.get('x-coordinator-email') || body.scanned_by;
      if (fallbackEmail && typeof fallbackEmail === 'string' && fallbackEmail.includes('@')) {
        const { data: coordByEmail } = await supabaseAdmin
          .from('admins')
          .select('*')
          .ilike('email', fallbackEmail.trim())
          .eq('active', true)
          .maybeSingle();

        if (coordByEmail) {
          admin = coordByEmail as any;
        }
      }
    }
    
    if (isAdminTest) {
      // 1. Fetch current admin test scan log from settings
      let newCount = 1;
      let updatedScans: any[] = [];
      const coordinatorId = admin?.id || body.coordinator_id || null;
      const coordinatorName = admin?.name || body.coordinator_name || (admin?.email ? admin.email.split('@')[0] : 'Gate Coordinator');
      const coordinatorEmail = admin?.email || body.coordinator_email || 'coordinator@terminal';
      const coordinatorRole = admin?.role || 'coordinator';
      const scannerDevice = scanner_device || body.scanner_device || request.headers.get('x-scanner-device') || 'Android Coordinator App';

      try {
        const { data: testSetting } = await supabaseAdmin
          .from('settings')
          .select('value')
          .eq('key', 'admin_test_qr_scans')
          .maybeSingle();

        const currentVal = testSetting?.value && typeof testSetting.value === 'object' ? (testSetting.value as any) : { count: 0, scans: [] };
        newCount = (Number(currentVal.count) || 0) + 1;

        const newScanEntry = {
          id: crypto.randomUUID(),
          coordinator_id: coordinatorId,
          coordinator_name: coordinatorName,
          coordinator_email: coordinatorEmail,
          role: coordinatorRole,
          scanned_at: new Date().toISOString(),
          scanner_device: scannerDevice
        };

        updatedScans = [newScanEntry, ...(Array.isArray(currentVal.scans) ? currentVal.scans : [])].slice(0, 500);

        await supabaseAdmin
          .from('settings')
          .upsert({
            key: 'admin_test_qr_scans',
            value: {
              count: newCount,
              scans: updatedScans
            },
            updated_at: new Date().toISOString()
          });
      } catch (logErr) {
        console.warn('Admin test scan log error:', logErr);
      }

      const studentData = {
        id: 'admin-test-id',
        ticket_id: 'ALGO26-ADMIN-TEST',
        ticket_token: 'admin-test',
        full_name: 'Coordinator - Scanned admin - test successfull',
        registration_number: 'ADMIN-TEST-QR',
        year: '4th Year' as const,
        school_name: 'School of Computing and Artificial Intelligence',
        modeling: 'Yes' as const,
        registration_status: 'PAID',
        entry_status: 'ENTERED',
        photo_url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z'/></svg>"
      };

      const entryDetailsData = {
        first_scanned_at: new Date().toISOString(),
        scanned_at: new Date().toISOString(),
        entry_time: new Date().toISOString(),
        scanned_by: `${coordinatorName} (${coordinatorEmail})`,
        total_entries: newCount,
        scanner_device: scannerDevice
      };

      return NextResponse.json({
        success: true,
        status: 'MARKED',
        message: 'Scanned admin - test successfull',
        data: {
          status: 'MARKED',
          message: 'Scanned admin - test successfull',
          student: studentData,
          entry_details: entryDetailsData,
          is_test: true
        },
        student: studentData,
        entry_details: entryDetailsData
      });
    }

    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to verify tickets. Please sign in.' }
      }, { status: 401 });
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

    // 3. Lookup candidate registration matching token, ticket ID, or registration number
    let { data: reg, error: regErr } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('ticket_token', cleanedToken)
      .maybeSingle();

    if (!reg) {
      // Also try by ticket_id (e.g. ALG26-CSE-0001 or AR-1027)
      const { data: byTicketId } = await supabaseAdmin
        .from('registrations')
        .select('*')
        .eq('ticket_id', cleanedToken)
        .maybeSingle();
      if (byTicketId) reg = byTicketId;
    }

    if (!reg) {
      // Also try by registration_number
      const { data: byRegNo } = await supabaseAdmin
        .from('registrations')
        .select('*')
        .eq('registration_number', cleanedToken)
        .maybeSingle();
      if (byRegNo) reg = byRegNo;
    }

    if (!reg) {
      // Also try by registration id (UUID)
      const { data: byId } = await supabaseAdmin
        .from('registrations')
        .select('*')
        .eq('id', cleanedToken)
        .maybeSingle();
      if (byId) reg = byId;
    }

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
          message: 'This ticket has been cancelled.'
        },
        data: { student: reg }
      }, { status: 400 });
    }

    // Check payment record for refunded state
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('payment_status, refund_status')
      .eq('registration_id', reg.id)
      .order('created_at', { ascending: false });

    const latestPay = payments?.[0];
    if (latestPay?.refund_status === 'REFUNDED') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'CANCELLED_TICKET',
          message: 'This ticket has been refunded and is no longer valid for entry.'
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
      photo_url: photoUrl,
      phone: reg.phone,
      email: reg.email
    };

    // 4. Check for duplicate scan matching the current mode (Test vs. Live)
    // Production database has legacy status values in entry_status, so query all entries for registration
    const { data: entriesForReg } = await supabaseAdmin
      .from('entries')
      .select('*')
      .eq('registration_id', reg.id);

    const existingEntry = isTest
      ? entriesForReg?.find((e: any) => e.is_test === true || e.entry_status === 'TEST_ENTERED')
      : entriesForReg?.find((e: any) => e.is_test !== true && e.entry_status !== 'TEST_ENTERED');

    if (existingEntry) {
      // Get coordinator details who scanned it originally
      let originalScannedBy = 'Staff';
      if (existingEntry.scanned_by) {
        originalScannedBy = existingEntry.scanned_by;
      }

      const prevTime = existingEntry.entry_time || existingEntry.scanned_at || null;
      
      return NextResponse.json({
        success: true,
        data: {
          status: 'ALREADY_ENTERED',
          student: formattedStudent,
          is_test: isTest,
          payment_status: reg.registration_status,
          entry_status: existingEntry.entry_status || 'ENTERED',
          previous_entry_time: prevTime,
          entry_details: {
            entry_time: prevTime,
            scanned_by: originalScannedBy,
            scanner_device: existingEntry.scanner_device || 'Web Browser',
            is_test: existingEntry.is_test
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
        payment_status: reg.registration_status,
        entry_status: 'NOT_ENTERED',
        previous_entry_time: null,
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
