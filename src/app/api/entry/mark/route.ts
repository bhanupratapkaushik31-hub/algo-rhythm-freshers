import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify administrative access
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin', 'scanner', 'coordinator']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to check in students.' }
      }, { status: 401 });
    }

    const { registration_id, action, is_test, scanner_device } = await request.json();
    if (!registration_id) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_REGISTRATION_ID', message: 'Registration ID is required.' }
      }, { status: 400 });
    }

    const markAction = action || 'ENTRY'; // default to ENTRY
    const isTest = !!is_test;

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

    // Check payment record for refunded state
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('payment_status, refund_status')
      .eq('registration_id', registration_id)
      .order('created_at', { ascending: false });

    const latestPay = payments?.[0];
    if (latestPay?.refund_status === 'REFUNDED') {
      return NextResponse.json({
        success: false,
        error: { code: 'CANCELLED_TICKET', message: 'Cannot mark entry. Ticket has been refunded.' }
      }, { status: 400 });
    }

    const timestamp = new Date().toISOString();
    let entryRecord = null;

    if (markAction === 'ENTRY') {
      // 3a. Insert check-in record in entries table
      const { data: newEntry, error: insertErr } = await supabaseAdmin
        .from('entries')
        .insert({
          registration_id: registration_id,
          ticket_id: reg.ticket_id,
          coordinator_id: admin.id,
          entry_status: 'ENTERED',
          scanned_by: admin.name || admin.email || 'Admin Staff',
          scanner_device: scanner_device || 'Web Browser',
          scanned_at: timestamp,
          entry_time: timestamp,
          is_test: isTest
        })
        .select()
        .single();

      if (insertErr) {
        console.error('Mark entry insertion error:', insertErr);
        
        // Unique constraint violation (means someone already entered simultaneously)
        if (insertErr.code === '23505') {
          return NextResponse.json({
            success: false,
            error: {
              code: 'ALREADY_ENTERED',
              message: 'This ticket has already been marked entered.'
            }
          }, { status: 400 });
        }

        return NextResponse.json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to record entry check-in.' }
        }, { status: 500 });
      }

      entryRecord = newEntry;
    } else if (markAction === 'RE_ENTRY') {
      // 3b. Update existing entry status to RE_ENTERED
      const { data: updatedEntry, error: updateErr } = await supabaseAdmin
        .from('entries')
        .update({
          entry_status: 'RE_ENTERED',
          scanned_by: admin.name || admin.email || 'Admin Staff',
          scanner_device: scanner_device || 'Web Browser',
          scanned_at: timestamp,
          coordinator_id: admin.id
        })
        .eq('registration_id', registration_id)
        .select()
        .maybeSingle();

      if (updateErr) {
        console.error('Mark re-entry update error:', updateErr);
      }
      entryRecord = updatedEntry;
    }

    // 3c. Insert detail audit log into entry_logs table
    const { error: logErr } = await supabaseAdmin
      .from('entry_logs')
      .insert({
        registration_id: registration_id,
        action: markAction,
        scanned_by: admin.name || admin.email || 'Admin Staff',
        scanner_device: scanner_device || 'Web Browser',
        scanned_at: timestamp
      });

    if (logErr) {
      console.error('Failed to write entry log history:', logErr);
      // We don't fail the whole request because entry check-in succeeded, but we should log it
    }

    return NextResponse.json({
      success: true,
      data: {
        message: markAction === 'ENTRY' ? 'Entry marked successfully.' : 'Re-entry approved successfully.',
        ticket_id: reg.ticket_id,
        action: markAction,
        entry: entryRecord || { registration_id, entry_time: timestamp }
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
