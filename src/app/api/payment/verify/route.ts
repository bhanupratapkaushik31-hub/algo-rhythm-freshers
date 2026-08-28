import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendTicketEmail } from '@/lib/email';
import { EVENT_CONFIG } from '@/config/event';
import crypto from 'crypto';
import Razorpay from 'razorpay';

export async function POST(request: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, registration_id } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !registration_id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'order_id, payment_id, signature, and registration_id are required.'
        }
      }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    if (!keySecret) {
      console.error('[Verify Payment] Razorpay secret missing on server.');
      return NextResponse.json({
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'Payment configuration error. Please contact admins.'
        }
      }, { status: 500 });
    }

    const dataToSign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(dataToSign)
      .digest('hex');

    let isVerified = false;
    try {
      isVerified = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpay_signature)
      );
    } catch (e) {
      isVerified = false;
    }

    if (!isVerified) {
      console.error('[Verify Payment] Signature mismatch.');
      return NextResponse.json({
        success: false,
        error: {
          code: 'VERIFICATION_FAILED',
          message: 'Payment signature verification failed. Untrusted request.'
        }
      }, { status: 400 });
    }

    // 2. Fetch payment record safely
    const { data: payments, error: payError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .order('created_at', { ascending: false });

    const payment = payments?.[0];

    if (payError || !payment) {
      console.error('[Verify Payment] DB error or payment not found:', payError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'PAYMENT_RECORD_NOT_FOUND',
          message: 'Payment order record was not found in the database.'
        }
      }, { status: 404 });
    }

    // 3. Confirm the order ID belongs to the correct registration
    if (payment.registration_id !== registration_id) {
      console.error(`[Verify Payment] Registration ID mismatch. Expected ${payment.registration_id}, got ${registration_id}`);
      return NextResponse.json({
        success: false,
        error: {
          code: 'REGISTRATION_MISMATCH',
          message: 'Payment order registration mismatch.'
        }
      }, { status: 400 });
    }

    // 4. Confirm amount matches configured ticket price
    const expectedPaise = Number(EVENT_CONFIG.registrationFeePaise) || 5000;
    if (payment.amount !== expectedPaise) {
      console.error(`[Verify Payment] Amount mismatch. Expected ${expectedPaise}, got ${payment.amount}`);
      return NextResponse.json({
        success: false,
        error: {
          code: 'AMOUNT_MISMATCH',
          message: 'Invalid payment amount detected.'
        }
      }, { status: 400 });
    }

    // 5. Confirm currency is INR
    if (payment.currency !== 'INR') {
      console.error(`[Verify Payment] Currency mismatch. Expected INR, got ${payment.currency}`);
      return NextResponse.json({
        success: false,
        error: {
          code: 'CURRENCY_MISMATCH',
          message: 'Invalid payment currency detected.'
        }
      }, { status: 400 });
    }

    const timestamp = new Date().toISOString();

    // Idempotency: If already paid, ensure registration is PAID and return success immediately
    if (payment.payment_status === 'SUCCESS') {
      const { data: reg } = await supabaseAdmin
        .from('registrations')
        .select('ticket_token, registration_status')
        .eq('id', payment.registration_id)
        .single();

      if (reg && reg.registration_status !== 'PAID') {
        await supabaseAdmin
          .from('registrations')
          .update({ registration_status: 'PAID', updated_at: timestamp })
          .eq('id', payment.registration_id);
      }

      return NextResponse.json({
        success: true,
        data: {
          ticket_token: reg?.ticket_token
        }
      });
    }

    // Fetch the payment details from Razorpay to get the actual payment method (upi, card, netbanking, etc)
    let paymentMethod = 'RAZORPAY';
    try {
      if (keyId) {
        const razorpay = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        if (paymentDetails && paymentDetails.method) {
          paymentMethod = paymentDetails.method;
        }
      }
    } catch (fetchErr) {
      console.warn('[Verify Payment] Failed to fetch payment details from Razorpay:', fetchErr);
    }

    // 3. Mark Payment as Success
    const { error: payUpdateError } = await supabaseAdmin
      .from('payments')
      .update({
        payment_status: 'SUCCESS',
        razorpay_payment_id,
        razorpay_signature,
        payment_method: paymentMethod,
        paid_at: timestamp,
        updated_at: timestamp
      })
      .eq('id', payment.id);

    if (payUpdateError) {
      console.error('[Verify Payment] Update payment error:', payUpdateError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update payment record.'
        }
      }, { status: 500 });
    }

    // 4. Mark Registration as Paid
    const { data: reg, error: regUpdateError } = await supabaseAdmin
      .from('registrations')
      .update({
        registration_status: 'PAID',
        updated_at: timestamp
      })
      .eq('id', payment.registration_id)
      .select('id, ticket_token, email')
      .single();

    if (regUpdateError || !reg) {
      console.error('Verify Payment: Update registration error:', regUpdateError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update registration status.'
        }
      }, { status: 500 });
    }

    // 5. Send Transactional Email (async, do not block user response on failure)
    sendTicketEmail(reg.id).catch((emailErr) => {
      console.error('Verification success but email failed to trigger:', emailErr);
    });

    return NextResponse.json({
      success: true,
      data: {
        ticket_token: reg.ticket_token
      }
    });

  } catch (err: any) {
    console.error('Verify Payment API error:', err);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Verification crashed.'
      }
    }, { status: 500 });
  }
}
