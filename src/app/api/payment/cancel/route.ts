import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { registration_id, reason } = await request.json();

    if (!registration_id) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Registration ID is required.' }
      }, { status: 400 });
    }

    // 1. Fetch current registration status
    const { data: reg, error: fetchErr } = await supabaseAdmin
      .from('registrations')
      .select('id, registration_status, ticket_token')
      .eq('id', registration_id)
      .maybeSingle();

    if (fetchErr || !reg) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Registration not found.' }
      }, { status: 404 });
    }

    // If already paid, do not cancel
    if (reg.registration_status === 'PAID') {
      return NextResponse.json({
        success: false,
        error: { code: 'ALREADY_PAID', message: 'Registration is already completed and paid.' }
      }, { status: 400 });
    }

    // 2. Mark registration as CANCELLED
    const { error: updateErr } = await supabaseAdmin
      .from('registrations')
      .update({
        registration_status: 'CANCELLED',
        updated_at: new Date().toISOString()
      })
      .eq('id', registration_id);

    if (updateErr) {
      console.error('Failed to cancel registration:', updateErr);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update registration status.' }
      }, { status: 500 });
    }

    // 3. Update pending payment records to FAILED / CANCELLED if any
    await supabaseAdmin
      .from('payments')
      .update({
        payment_status: 'FAILED',
        updated_at: new Date().toISOString()
      })
      .eq('registration_id', registration_id)
      .eq('payment_status', 'PENDING');

    return NextResponse.json({
      success: true,
      data: {
        message: 'Payment session was cancelled due to timeout or exit.',
        reason: reason || 'SESSION_TIMEOUT'
      }
    });

  } catch (err: any) {
    console.error('Cancel payment API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
