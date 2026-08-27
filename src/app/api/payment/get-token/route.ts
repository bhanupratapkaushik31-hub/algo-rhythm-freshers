import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get('payment_id');

    if (!paymentId) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_PAYMENT_ID', message: 'payment_id query parameter is required.' }
      }, { status: 400 });
    }

    // 1. Fetch payment record
    const { data: payment, error: payError } = await supabaseAdmin
      .from('payments')
      .select('registration_id, payment_status')
      .eq('razorpay_payment_id', paymentId)
      .maybeSingle();

    if (payError) {
      console.error('Get Token API: DB error fetching payment:', payError);
      return NextResponse.json({ success: false, message: 'DB query failed' }, { status: 500 });
    }

    if (!payment) {
      return NextResponse.json({
        success: false,
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment record not found yet.' }
      }, { status: 404 });
    }

    if (payment.payment_status !== 'SUCCESS') {
      return NextResponse.json({
        success: false,
        error: { code: 'PAYMENT_PENDING', message: 'Payment is not successfully completed yet.' }
      }, { status: 400 });
    }

    // 2. Fetch ticket token from registration
    const { data: reg, error: regError } = await supabaseAdmin
      .from('registrations')
      .select('ticket_token')
      .eq('id', payment.registration_id)
      .maybeSingle();

    if (regError || !reg) {
      console.error('Get Token API: DB error fetching registration:', regError);
      return NextResponse.json({ success: false, message: 'Registration not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ticket_token: reg.ticket_token
      }
    });

  } catch (err: any) {
    console.error('Get Token API error:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Server crash' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
