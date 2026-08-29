import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendTicketEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // 1. Guard: Strictly permanently disabled in production or whenever Razorpay is configured
    const isProduction = process.env.NODE_ENV === 'production';
    const hasRazorpayKeys = !!(process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('placeholder'));
    const isSimulatorAllowed = !isProduction && !hasRazorpayKeys && process.env.ALLOW_PAYMENT_SIMULATOR === 'true';

    if (!isSimulatorAllowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Payment simulator is permanently disabled. Real Razorpay payment verification is required.'
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
      console.error('Test Success: Payment record not found:', payError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'The associated payment order was not found.'
        }
      }, { status: 404 });
    }

    // 3. Verify associated registration exists
    const { data: reg, error: regError } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('id', payment.registration_id)
      .maybeSingle();

    if (regError || !reg) {
      console.error('Test Success: Registration not found:', regError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Associated student registration was not found.'
        }
      }, { status: 404 });
    }

    // 4. Verify amount is exactly 5000 paise (50 INR)
    if (payment.amount !== 5000) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Simulator payment amount must be exactly 5000 paise.'
        }
      }, { status: 400 });
    }

    // 5. Idempotency Check: if already paid, return ticket token immediately
    if (payment.payment_status === 'SUCCESS') {
      return NextResponse.json({
        success: true,
        data: {
          ticket_token: reg.ticket_token
        }
      });
    }

    const timestamp = new Date().toISOString();
    const testPaymentId = `pay_test_${crypto.randomBytes(8).toString('hex')}`;

    // 6. Update payment record in Supabase
    const { error: payUpdateError } = await supabaseAdmin
      .from('payments')
      .update({
        payment_status: 'SUCCESS',
        razorpay_payment_id: testPaymentId,
        payment_method: 'TEST_SIMULATOR',
        paid_at: timestamp,
        updated_at: timestamp
      })
      .eq('id', payment.id);

    if (payUpdateError) {
      console.error('Test Success: Update payment error:', payUpdateError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update payment record.'
        }
      }, { status: 500 });
    }

    // 7. Update associated registration payment status
    const { data: updatedReg, error: regUpdateError } = await supabaseAdmin
      .from('registrations')
      .update({
        registration_status: 'PAID',
        updated_at: timestamp
      })
      .eq('id', payment.registration_id)
      .select('id, ticket_token')
      .single();

    if (regUpdateError || !updatedReg) {
      console.error('Test Success: Update registration error:', regUpdateError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update registration status.'
        }
      }, { status: 500 });
    }

    // 8. Send ticket email through Resend and await execution
    try {
      await sendTicketEmail(updatedReg.id);
    } catch (emailErr) {
      console.error('Test Success: Email sending exception:', emailErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        ticket_token: updatedReg.ticket_token
      }
    });

  } catch (err: any) {
    console.error('Test Success API error:', err);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Payment simulator success workflow failed.'
      }
    }, { status: 500 });
  }
}
