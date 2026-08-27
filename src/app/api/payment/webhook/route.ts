import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendTicketEmail } from '@/lib/email';
import { initiateAutoRefund } from '@/lib/refund';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    if (!signature) {
      console.warn('[Webhook Error] Webhook signature header x-razorpay-signature is missing.');
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_SIGNATURE', message: 'Webhook signature is missing.' }
      }, { status: 400 });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhook Error] RAZORPAY_WEBHOOK_SECRET is missing in environment configurations.');
      return NextResponse.json({
        success: false,
        error: { code: 'CONFIG_ERROR', message: 'Webhook secret is not configured.' }
      }, { status: 500 });
    }

    // 1. Verify Webhook Signature using HMAC SHA256 as recommended by Razorpay
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    let isVerified = false;
    try {
      isVerified = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
    } catch (e) {
      isVerified = false;
    }

    if (!isVerified) {
      console.warn('[Webhook Error] Webhook signature verification failed. Mismatched signature.');
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed.' }
      }, { status: 400 });
    }

    // 2. Parse Payload
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const eventId = payload.id;

    console.log(`[Webhook] Webhook received. Event: ${event}, Event ID: ${eventId}`);

    // 3. Idempotency Check using webhook_events table
    if (eventId) {
      try {
        const { data: existingEvent } = await supabaseAdmin
          .from('webhook_events')
          .select('id')
          .eq('id', eventId)
          .maybeSingle();

        if (existingEvent) {
          console.log(`[Webhook] Event ${eventId} has already been processed. Skipping (Idempotency).`);
          return NextResponse.json({ success: true, message: 'Event already processed' });
        }
      } catch (dbErr) {
        console.warn('[Webhook Warning] Could not query webhook_events table for idempotency check (table may not exist yet):', dbErr);
      }
    }

    // 4. Handle events
    // 4. Handle events
    if (event === 'payment.captured') {
      const paymentEntity = payload.payload.payment?.entity;
      if (!paymentEntity) {
        console.error('[Webhook Error] Malformed payment.captured payload: payment entity is missing.');
        return NextResponse.json({ success: false, error: { message: 'Malformed payload' } }, { status: 400 });
      }

      const razorpayPaymentId = paymentEntity.id;
      const razorpayOrderId = paymentEntity.order_id;
      const amount = paymentEntity.amount; // in paise
      const currency = paymentEntity.currency;
      const paymentMethod = paymentEntity.method;

      console.log(`[Webhook] Processing payment.captured. Payment ID: ${razorpayPaymentId}, Order ID: ${razorpayOrderId}, Amount: ${amount}`);

      if (!razorpayOrderId) {
        console.error('[Webhook Error] payment.captured payload is missing order_id. Refunding.');
        await initiateAutoRefund(razorpayPaymentId, null, 'Captured payment payload is missing order_id.');
        return NextResponse.json({ success: true, message: 'Refund initiated (missing order_id)' });
      }

      // Verify that the payment belongs to the correct registration/order
      const { data: payment, error: fetchPayErr } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('razorpay_order_id', razorpayOrderId)
        .maybeSingle();

      if (fetchPayErr) {
        console.error('[Webhook DB Error] Failed to fetch payment record:', fetchPayErr);
        return NextResponse.json({ success: false, message: 'DB fetch failed' }, { status: 500 });
      }

      if (!payment) {
        console.warn(`[Webhook] No local payment record found for Order ID: ${razorpayOrderId}. Refunding.`);
        await initiateAutoRefund(razorpayPaymentId, null, 'No local payment record found in database.');
        return NextResponse.json({ success: true, message: 'Refund initiated (no local record)' });
      }

      // Verify amount (₹50 = 5000 paise)
      if (amount !== 5000 || currency !== 'INR') {
        console.error(`[Webhook Error] Amount or currency mismatch. Expected 5000 INR, got ${amount} ${currency}`);
        await initiateAutoRefund(razorpayPaymentId, payment.registration_id, `Amount mismatch. Expected 5000 INR, got ${amount} ${currency}.`);
        return NextResponse.json({ success: false, error: { message: 'Amount/currency mismatch. Refund initiated.' } }, { status: 400 });
      }

      const timestamp = new Date().toISOString();

      // Update payment record in database if not already SUCCESS
      if (payment.payment_status !== 'SUCCESS') {
        const { error: payUpdateErr } = await supabaseAdmin
          .from('payments')
          .update({
            payment_status: 'SUCCESS',
            razorpay_payment_id: razorpayPaymentId,
            payment_method: paymentMethod || 'RAZORPAY',
            paid_at: timestamp,
            updated_at: timestamp
          })
          .eq('id', payment.id);

        if (payUpdateErr) {
          console.error('[Webhook DB Error] Failed to update payment record status:', payUpdateErr);
          return NextResponse.json({ success: false, message: 'Payment update failed' }, { status: 500 });
        }
      }

      // Fetch current registration status to double check email and paid status
      const { data: reg, error: fetchRegErr } = await supabaseAdmin
        .from('registrations')
        .select('registration_status, email_sent, ticket_token, full_name, registration_number, email')
        .eq('id', payment.registration_id)
        .maybeSingle();

      if (fetchRegErr || !reg) {
        console.error(`[Webhook Error] Associated registration ${payment.registration_id} not found. Refunding.`);
        await initiateAutoRefund(razorpayPaymentId, payment.registration_id, 'Associated registration record not found.');
        return NextResponse.json({ success: true, message: 'Refund initiated (no registration record)' });
      }

      const isAlreadyPaid = reg.registration_status === 'PAID';
      const isEmailSent = reg.email_sent;

      // Update registration record if not already PAID
      if (!isAlreadyPaid) {
        const { error: regUpdateErr } = await supabaseAdmin
          .from('registrations')
          .update({
            registration_status: 'PAID',
            updated_at: timestamp
          })
          .eq('id', payment.registration_id);

        if (regUpdateErr) {
          console.error('[Webhook DB Error] Failed to update registration status to PAID. Initiating refund:', regUpdateErr);
          await initiateAutoRefund(razorpayPaymentId, payment.registration_id, 'Failed to update registration status in database.', {
            name: reg.full_name,
            registrationNumber: reg.registration_number,
            email: reg.email
          });
          return NextResponse.json({ success: false, message: 'Registration update failed. Refund initiated.' }, { status: 500 });
        }
      }

      // Trigger Email Confirmation if not already sent
      if (!isEmailSent) {
        await sendTicketEmail(payment.registration_id);
      } else {
        console.log(`[Webhook] Ticket email already sent for registration ${payment.registration_id}. Skipping duplicate send.`);
      }

      console.log(`[Webhook Result] Successfully processed payment.captured for order: ${razorpayOrderId}`);

    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payload.payment?.entity;
      if (!paymentEntity) {
        console.error('[Webhook Error] Malformed payment.failed payload: payment entity is missing.');
        return NextResponse.json({ success: false, error: { message: 'Malformed payload' } }, { status: 400 });
      }

      const razorpayPaymentId = paymentEntity.id;
      const razorpayOrderId = paymentEntity.order_id;
      const failureReason = paymentEntity.error_description || 'Payment failed';

      console.log(`[Webhook] Processing payment.failed. Payment ID: ${razorpayPaymentId}, Order ID: ${razorpayOrderId}, Reason: ${failureReason}`);

      if (razorpayOrderId) {
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('razorpay_order_id', razorpayOrderId)
          .maybeSingle();

        if (payment && payment.payment_status !== 'SUCCESS') {
          const timestamp = new Date().toISOString();
          await supabaseAdmin
            .from('payments')
            .update({
              payment_status: 'FAILED',
              razorpay_payment_id: razorpayPaymentId,
              failure_reason: failureReason,
              failed_at: timestamp,
              updated_at: timestamp
            })
            .eq('id', payment.id);

          console.log(`[Webhook Result] Payment failure recorded for Order ID: ${razorpayOrderId}. Reason: ${failureReason}`);
        }
      }
    } else if (event === 'payment.authorized') {
      console.log(`[Webhook] Payment authorized but not yet captured. Waiting for capture event.`);
      return NextResponse.json({ success: true, message: 'Authorization logged' });
    } else if (event === 'order.paid') {
      console.log(`[Webhook] Order paid logged. Let payment.captured event perform the verification.`);
      return NextResponse.json({ success: true, message: 'Order paid logged' });
    }

    // 5. Log processed webhook event in idempotency table
    if (eventId) {
      try {
        await supabaseAdmin
          .from('webhook_events')
          .insert({
            id: eventId,
            event_type: event,
            processed_at: new Date().toISOString()
          });
      } catch (insertEventErr) {
        // Suppress warning if table is not migrated yet
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Webhook Error] Webhook handler crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Webhook crash' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
