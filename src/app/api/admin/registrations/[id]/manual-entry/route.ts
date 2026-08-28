import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. Verify admin permissions (Allowed: super_admin, admin)
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to make entry corrections.' }
      }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Registration ID is required.' }
      }, { status: 400 });
    }

    const { action } = await request.json();

    if (action === 'checkin') {
      // 2. Double check registration status (must be PAID to manually check-in)
      const { data: reg, error: regErr } = await supabaseAdmin
        .from('registrations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (regErr || !reg) {
        return NextResponse.json({
          success: false,
          error: { code: 'REGISTRATION_NOT_FOUND', message: 'Student registration record not found.' }
        }, { status: 404 });
      }

      if (reg.registration_status !== 'PAID') {
        return NextResponse.json({
          success: false,
          error: { code: 'UNPAID_TICKET', message: 'Cannot mark manual check-in. Ticket is unpaid.' }
        }, { status: 400 });
      }

      const timestamp = new Date().toISOString();

      // 3. Insert check-in record
      const { error: insertErr } = await supabaseAdmin
        .from('entries')
        .insert({
          registration_id: id,
          ticket_id: reg.ticket_id,
          coordinator_id: admin.id,
          entry_status: 'ENTERED',
          scanned_by: `${admin.name || admin.email} (Admin Manual)`,
          scanner_device: 'Admin Dashboard',
          scanned_at: timestamp,
          status: 'ENTERED',
          entry_time: timestamp,
          is_test: false
        });

      if (insertErr) {
        if (insertErr.code === '23505') {
          return NextResponse.json({
            success: false,
            error: { code: 'ALREADY_ENTERED', message: 'Attendee is already checked-in.' }
          }, { status: 400 });
        }
        console.error('Manual checkin error:', insertErr);
        return NextResponse.json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to insert entry log.' }
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Attendee checked-in successfully.'
      });

    } else if (action === 'reset') {
      // 4. Delete entry record
      const { error: deleteErr } = await supabaseAdmin
        .from('entries')
        .delete()
        .eq('registration_id', id);

      if (deleteErr) {
        console.error('Reset checkin DB error:', deleteErr);
        return NextResponse.json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to remove entry log.' }
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Attendee check-in reset successfully.'
      });

    } else {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_ACTION', message: "Action must be either 'checkin' or 'reset'." }
      }, { status: 400 });
    }

  } catch (err: any) {
    console.error('Manual entry API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
