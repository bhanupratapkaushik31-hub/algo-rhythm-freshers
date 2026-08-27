import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendTicketEmail } from '@/lib/email';
import Razorpay from 'razorpay';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const registrationId = searchParams.get('registration_id');

    if (!registrationId) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_REGISTRATION_ID', message: 'registration_id parameter is required.' }
      }, { status: 400 });
    }

    // 1. Fetch registration
    const { data: reg, error: regError } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .maybeSingle();

    if (regError || !reg) {
      return NextResponse.json({
        success: false,
        error: { code: 'REGISTRATION_NOT_FOUND', message: 'Registration record was not found.' }
      }, { status: 404 });
    }

    // 2. Fetch payment record
    const { data: payment, error: payError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('registration_id', registrationId)
      .maybeSingle();

    if (payError) {
      console.error('Status API: DB error fetching payment:', payError);
      return NextResponse.json({ success: false, message: 'DB query failed' }, { status: 500 });
    }

    if (!payment) {
      return NextResponse.json({
        success: true,
        data: { status: 'PENDING' } // No payment created yet
      });
    }

    // Self-healing: If payment is marked PENDING in DB, check Razorpay directly
    if (payment.payment_status === 'PENDING' && payment.razorpay_order_id) {
      try {
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID || '',
          key_secret: process.env.RAZORPAY_KEY_SECRET || '',
        });

        // Fetch payments for this specific order
        const rzpPayments = await razorpay.orders.fetchPayments(payment.razorpay_order_id);
        const capturedPay = rzpPayments.items?.find((p: any) => p.status === 'captured');

        if (capturedPay) {
          console.log(`[Status Self-Healing] Found captured payment ${capturedPay.id} for order ${payment.razorpay_order_id}. Healing DB state.`);
          
          const timestamp = new Date().toISOString();

          // 1. Update payment to SUCCESS
          await supabaseAdmin
            .from('payments')
            .update({
              payment_status: 'SUCCESS',
              razorpay_payment_id: capturedPay.id,
              payment_method: capturedPay.method || 'RAZORPAY',
              paid_at: timestamp,
              updated_at: timestamp
            })
            .eq('id', payment.id);

          // 2. Update registration status to PAID
          await supabaseAdmin
            .from('registrations')
            .update({
              registration_status: 'PAID',
              updated_at: timestamp
            })
            .eq('id', registrationId);

          // 3. Trigger ticket email send
          if (!reg.email_sent) {
            await sendTicketEmail(registrationId);
          }

          // Return success status immediately
          return NextResponse.json({
            success: true,
            data: {
              status: 'SUCCESS',
              ticket_token: reg.ticket_token
            }
          });
        }
      } catch (rzpErr) {
        console.warn('[Status Self-Healing] Razorpay API query failed:', rzpErr);
      }
    }

    // 3. Map status values for user interface
    let uiStatus = 'PENDING';
    
    // Check refund columns if they exist in payment record
    const refundStatus = payment.refund_status || 'NOT_REQUIRED';

    if (refundStatus === 'REFUNDED') {
      uiStatus = 'REFUNDED';
    } else if (refundStatus === 'PROCESSING') {
      uiStatus = 'REFUND_PROCESSING';
    } else if (payment.payment_status === 'SUCCESS') {
      uiStatus = 'SUCCESS';
    } else if (payment.payment_status === 'FAILED') {
      uiStatus = 'FAILED';
    } else {
      uiStatus = 'PENDING';
    }

    return NextResponse.json({
      success: true,
      data: {
        status: uiStatus,
        ticket_token: reg.ticket_token
      }
    });

  } catch (err: any) {
    console.error('Status API error:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Server crash' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
