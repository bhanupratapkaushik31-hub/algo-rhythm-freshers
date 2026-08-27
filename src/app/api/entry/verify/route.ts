import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify coordinator access (super_admin, admin, or scanner/coordinator)
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin', 'scanner', 'coordinator']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to verify tickets.' }
      }, { status: 401 });
    }

    const { ticket_token, scanner_device } = await request.json();
    if (!ticket_token) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Ticket token is required.' }
      }, { status: 400 });
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
        error: { code: 'INVALID_TICKET', message: 'Ticket could not be verified.' }
      }, { status: 404 });
    }

    // 3. Verify Payment Status (Must be SUCCESS / PAID)
    if (reg.registration_status !== 'PAID') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNPAID_TICKET',
          message: 'Entry is not permitted (Payment status: NOT VERIFIED).'
        },
        data: { student: reg }
      }, { status: 400 });
    }

    const timestamp = new Date().toISOString();

    // 4. Atomically insert entry record
    const { data: newEntry, error: insertErr } = await supabaseAdmin
      .from('entries')
      .insert({
        registration_id: reg.id,
        ticket_id: reg.ticket_id,
        coordinator_id: admin.id,
        entry_status: 'ENTERED',
        scanned_by: admin.email,
        scanner_device: scanner_device || 'Mobile QR Terminal',
        scanned_at: timestamp,
        status: 'ENTERED',
        entry_time: timestamp
      })
      .select()
      .single();

    if (insertErr) {
      // 5. Unique constraint violation (Double Scan Race Condition)
      if (insertErr.code === '23505') {
        // Fetch existing check-in details
        const { data: existingEntry } = await supabaseAdmin
          .from('entries')
          .select('*')
          .eq('registration_id', reg.id)
          .maybeSingle();

        // Get coordinator details who scanned it originally
        let originalScannedBy = 'Staff';
        if (existingEntry) {
          originalScannedBy = existingEntry.scanned_by || 'Staff';
          // Try to fetch name if possible
          const { data: coordRecord } = await supabaseAdmin
            .from('admins')
            .select('name')
            .eq('id', existingEntry.coordinator_id || '')
            .maybeSingle();
          if (coordRecord?.name) {
            originalScannedBy = coordRecord.name;
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            status: 'ALREADY_ENTERED',
            student: reg,
            entry_details: {
              entry_time: existingEntry ? existingEntry.entry_time : timestamp,
              scanned_by: originalScannedBy,
              scanner_device: existingEntry ? existingEntry.scanner_device : 'Web Browser'
            }
          }
        });
      }

      console.error('Verify entry insert error:', insertErr);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to record entry check-in.' }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        status: 'MARKED',
        student: reg,
        entry_details: {
          entry_time: timestamp,
          scanned_by: admin.name || admin.email
        }
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
