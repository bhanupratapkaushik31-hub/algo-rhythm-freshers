import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify administrative access
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin', 'scanner']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to check in students.' }
      }, { status: 401 });
    }

    const { registration_id, scanner_device } = await request.json();
    if (!registration_id) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_REGISTRATION_ID', message: 'Registration ID is required.' }
      }, { status: 400 });
    }

    // 2. Double check registration status (must be PAID)
    const { data: reg, error: regErr } = await supabaseAdmin
      .from('registrations')
      .select('registration_status, ticket_id')
      .eq('id', registration_id)
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
        error: { code: 'UNPAID_TICKET', message: 'Cannot mark entry. Ticket is unpaid.' }
      }, { status: 400 });
    }

    // 3. Insert check-in record
    const { data: newEntry, error: insertErr } = await supabaseAdmin
      .from('entries')
      .insert({
        registration_id: registration_id,
        ticket_id: reg.ticket_id,
        coordinator_id: admin.id,
        entry_status: 'ENTERED',
        scanned_by: admin.email,
        scanner_device: scanner_device || 'Web Browser',
        scanned_at: new Date().toISOString(),
        status: 'ENTERED'
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Mark entry insertion error:', insertErr);
      
      // Unique constraint violation (means someone already entered)
      if (insertErr.code === '23505') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'ALREADY_ENTERED',
            message: 'This ticket has already been used for entry.'
          }
        }, { status: 400 });
      }

      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to record entry check-in.' }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Entry marked successfully.',
        ticket_id: reg.ticket_id,
        entry: newEntry
      }
    });

  } catch (err: any) {
    console.error('Entry mark API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}
