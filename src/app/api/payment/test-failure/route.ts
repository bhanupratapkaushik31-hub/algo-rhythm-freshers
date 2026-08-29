import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    // 1. Guard: Strictly permanently disabled in production
    if (process.env.NODE_ENV === 'production' || process.env.PAYMENT_MODE !== 'simulator') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Payment simulator is permanently disabled in production.'
        }
      }, { status: 403 });
    }

    const { payment_order_id } = await request.json();

    if (!payment_order_id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_ORDER_ID',
          message: 'payment_order_id is required.'
        }
      }, { status: 400 });
    }

    // 2. Verify payment record exists in Supabase
    const { data: payment, error: payError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('razorpay_order_id', payment_order_id)
      .maybeSingle();

    if (payError || !payment) {
      console.error('Test Failure: Payment record not found:', payError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'The associated payment order was not found.'
        }
      }, { status: 404 });
    }

    const timestamp = new Date().toISOString();

    // 3. Update payment record in Supabase to FAILED
    const { error: payUpdateError } = await supabaseAdmin
      .from('payments')
      .update({
        payment_status: 'FAILED',
        payment_method: 'TEST_SIMULATOR',
        failure_reason: 'TEST_PAYMENT_FAILURE',
        failed_at: timestamp,
        updated_at: timestamp
      })
      .eq('id', payment.id);

    if (payUpdateError) {
      console.error('Test Failure: Update payment error:', payUpdateError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update payment record.'
        }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Simulated payment failure recorded.'
    });

  } catch (err: any) {
    console.error('Test Failure API error:', err);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Payment simulator failure workflow failed.'
      }
    }, { status: 500 });
  }
}
