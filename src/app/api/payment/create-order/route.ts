import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { EVENT_CONFIG } from '@/config/event';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import Razorpay from 'razorpay';

export async function POST(request: NextRequest) {
  try {
    // 0. Rate limiting (max 15 orders per minute per IP)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, 'create-order', { limit: 15, windowMs: 60000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please wait a moment before trying again.'
        }
      }, { status: 429 });
    }

    const { registration_id } = await request.json();

    if (!registration_id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_REGISTRATION_ID',
          message: 'Registration ID is required.'
        }
      }, { status: 400 });
    }

    // 1. Fetch registration
    const { data: reg, error: regError } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('id', registration_id)
      .maybeSingle();

    if (regError || !reg) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Student registration not found.'
        }
      }, { status: 404 });
    }

    if (reg.registration_status === 'PAID') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ALREADY_PAID',
          message: 'Payment already completed.',
          ticket_token: reg.ticket_token
        }
      }, { status: 400 });
    }

    if (reg.registration_status === 'CANCELLED') {
      await supabaseAdmin
        .from('registrations')
        .update({ registration_status: 'PENDING', updated_at: new Date().toISOString() })
        .eq('id', registration_id);
    }

    // 2. Initialize Razorpay credentials & calculate year-based fee (125 -> 2nd Year ₹200, 126 -> 1st Year ₹100)
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    const resolvedYear = EVENT_CONFIG.getYearFromRegNo(reg.registration_number) || reg.year || '1st Year';
    const amountInPaise = EVENT_CONFIG.getFeeForYear(resolvedYear).paise; // ₹100 (1st Year) or ₹200 (2nd Year) in paise
    const isRazorpayConfigured = !!(keyId && keySecret && !keyId.includes('placeholder') && !keySecret.includes('placeholder'));

    if (!isRazorpayConfigured) {
      console.error('[Create Order] Razorpay credentials missing or invalid in live mode.');
      return NextResponse.json({
        success: false,
        error: {
          code: 'PAYMENT_CONFIG_ERROR',
          message: 'Payment gateway is currently not configured on the server. Please contact administrators.'
        }
      }, { status: 500 });
    }

    // 3. Check for existing payment record & order reuse (Duplicate order prevention)
    const { data: existingPayments, error: fetchPayError } = await supabaseAdmin
      .from('payments')
      .select('id, razorpay_order_id, amount, payment_status, created_at, updated_at')
      .eq('registration_id', reg.id)
      .order('created_at', { ascending: false });

    if (fetchPayError) {
      console.error('[Create Order] Failed to query existing payments:', fetchPayError);
    }

    let orderId = '';
    const latestPayment = existingPayments && existingPayments.length > 0 ? existingPayments[0] : null;

    // Check if we can safely reuse a recent genuine Razorpay order (created within last 15 minutes with matching amount).
    // IMPORTANT: The register route pre-populates a fake placeholder like `order_pending_xxx`.
    // These must NEVER be passed to Razorpay checkout — they don't exist as real orders.
    if (latestPayment && latestPayment.payment_status === 'PENDING' && latestPayment.razorpay_order_id) {
      const orderCreatedAt = new Date(latestPayment.updated_at || latestPayment.created_at).getTime();
      const ageMinutes = (Date.now() - orderCreatedAt) / (1000 * 60);

      // A genuine Razorpay order ID starts with 'order_' but is NOT a local placeholder.
      const ordId = latestPayment.razorpay_order_id;
      const isRealRazorpayOrder =
        ordId.startsWith('order_') &&
        !ordId.startsWith('order_pending_') &&
        !ordId.startsWith('order_sim_') &&
        !ordId.startsWith('order_mock_') &&
        !ordId.includes('sim');

      const isAmountMatching = Number(latestPayment.amount) === amountInPaise;

      if (isRealRazorpayOrder && isAmountMatching && ageMinutes < 15) {
        orderId = ordId;
        console.log(`[Create Order] Reusing genuine Razorpay order: ${orderId} for registration: ${reg.id} (amount: ${amountInPaise})`);
      } else if (!isAmountMatching) {
        console.log(`[Create Order] Order amount changed (${latestPayment.amount} -> ${amountInPaise}) — will create a fresh order.`);
      } else if (!isRealRazorpayOrder) {
        console.log(`[Create Order] Skipping placeholder/fake order ID "${ordId}" — will create a fresh real order.`);
      } else {
        console.log(`[Create Order] Existing order is stale (${ageMinutes.toFixed(1)} min old) — will create a fresh real order.`);
      }
    }

    // If no reusable order exists, generate a real live Razorpay order
    if (!orderId) {
      const razorpay = new Razorpay({
        key_id: keyId!,
        key_secret: keySecret!,
      });

      const orderOptions = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${reg.id.substring(0, 8)}_${Date.now().toString().slice(-4)}`,
        notes: {
          registration_id: reg.id,
          registration_number: reg.registration_number,
          full_name: reg.full_name,
          email: reg.email,
        },
      };

      const realOrder = await razorpay.orders.create(orderOptions);
      orderId = realOrder.id;
      console.log(`[Create Order] Successfully created Razorpay order: ${orderId} for registration: ${reg.id}`);
    }

    // 4. Save/Update Payment record in database cleanly without duplicate records
    const timestamp = new Date().toISOString();

    if (latestPayment) {
      const { error: updateError } = await supabaseAdmin
        .from('payments')
        .update({
          razorpay_order_id: orderId,
          amount: amountInPaise,
          currency: 'INR',
          payment_status: 'PENDING',
          updated_at: timestamp
        })
        .eq('id', latestPayment.id);

      if (updateError) {
        console.error('[Create Order] Payment record update error:', updateError);
        return NextResponse.json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to record payment order.'
          }
        }, { status: 500 });
      }

      // If duplicate pending records exist, clean up redundant ones
      if (existingPayments.length > 1) {
        const redundantIds = existingPayments
          .slice(1)
          .filter((p: { id: string; payment_status: string }) => p.payment_status === 'PENDING')
          .map((p: { id: string; payment_status: string }) => p.id);

        if (redundantIds.length > 0) {
          await supabaseAdmin
            .from('payments')
            .delete()
            .in('id', redundantIds);
        }
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('payments')
        .insert({
          registration_id: reg.id,
          razorpay_order_id: orderId,
          amount: amountInPaise,
          currency: 'INR',
          payment_status: 'PENDING'
        });

      if (insertError) {
        console.error('[Create Order] Payment record insert error:', insertError);
        return NextResponse.json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to record payment order.'
          }
        }, { status: 500 });
      }
    }

    // 5. Return success with Order info and public Key ID (never secret)
    return NextResponse.json({
      success: true,
      data: {
        order_id: orderId,
        amount: amountInPaise,
        currency: 'INR',
        key_id: keyId || '',
        razorpay_configured: isRazorpayConfigured,
        payment_mode: 'live',
        student: {
          name: reg.full_name,
          email: reg.email,
          phone: reg.phone,
          registration_number: reg.registration_number,
          year: reg.year,
        }
      }
    });

  } catch (err: any) {
    console.error('[Create Order API Error]:', err);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong. Please try again later.'
      }
    }, { status: 500 });
  }
}


