import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendTicketEmail } from '@/lib/email';
import { EVENT_CONFIG } from '@/config/event';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import crypto from 'crypto';
import Razorpay from 'razorpay';

export async function POST(request: NextRequest) {
  try {
    // 0. Rate limiting (max 15 verification calls per minute per IP)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, 'payment-verify', { limit: 15, windowMs: 60000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please wait a moment before trying again.'
        }
      }, { status: 429 });
    }

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
          message: 'Payment configuration error. Please contact administrators.'
        }
      }, { status: 500 });
    }

    // 1. Verify HMAC SHA-256 Signature
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

    // 6. Direct server-to-server Razorpay API verification
    let paymentMethod = 'RAZORPAY';
    if (keyId && !keyId.includes('placeholder')) {
      try {
        const razorpay = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });

        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        if (!paymentDetails) {
          return NextResponse.json({
            success: false,
            error: {
              code: 'RAZORPAY_FETCH_FAILED',
              message: 'Could not fetch payment verification from Razorpay.'
            }
          }, { status: 400 });
        }

        // Verify order ID and amount in Razorpay's direct response
        if (paymentDetails.order_id !== razorpay_order_id) {
          console.error(`[Verify Payment] Razorpay order_id mismatch. Expected ${razorpay_order_id}, got ${paymentDetails.order_id}`);
          return NextResponse.json({
            success: false,
            error: {
              code: 'ORDER_MISMATCH',
              message: 'Payment does not match the created order.'
            }
          }, { status: 400 });
        }

        if (paymentDetails.amount !== expectedPaise) {
          console.error(`[Verify Payment] Razorpay amount mismatch. Expected ${expectedPaise}, got ${paymentDetails.amount}`);
          return NextResponse.json({
            success: false,
            error: {
              code: 'AMOUNT_MISMATCH',
              message: 'Payment amount mismatch detected.'
            }
          }, { status: 400 });
        }

        // Verify payment status is captured
        if (paymentDetails.status !== 'captured') {
          console.warn(`[Verify Payment] Payment status is ${paymentDetails.status}, not captured.`);
          return NextResponse.json({
            success: false,
            error: {
              code: 'PAYMENT_NOT_CAPTURED',
              message: `Payment status is ${paymentDetails.status}. Funds were not captured.`
            }
          }, { status: 400 });
        }

        if (paymentDetails.method) {
          paymentMethod = paymentDetails.method;
        }
      } catch (fetchErr: any) {
        console.error('[Verify Payment] Failed to verify payment with Razorpay API:', fetchErr);
        return NextResponse.json({
          success: false,
          error: {
            code: 'GATEWAY_VERIFICATION_ERROR',
            message: 'Unable to verify payment with Razorpay gateway. Please retry or contact support.'
          }
        }, { status: 502 });
      }
    }

    // 7. Mark Payment as SUCCESS in database
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

    // 8. Mark Registration as PAID
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
      console.error('[Verify Payment] Update registration error:', regUpdateError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update registration status.'
        }
      }, { status: 500 });
    }

    // 9. Send Transactional Email (async, do not block user response on failure)
    sendTicketEmail(reg.id).catch((emailErr) => {
      console.error('[Verify Payment] Email failed to trigger:', emailErr);
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
        message: 'Verification could not be completed. Please try again.'
      }
    }, { status: 500 });
  }
}

