import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { EVENT_CONFIG } from '@/config/event';
import Razorpay from 'razorpay';

export async function POST(request: NextRequest) {
  try {
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

    // 2. Initialize Razorpay credentials & mode
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    const isSimulatorMode = process.env.PAYMENT_MODE === 'simulator';
    const amountInPaise = Number(EVENT_CONFIG.registrationFeePaise) || 5000;
    const isRazorpayConfigured = !!(keyId && keySecret && !keyId.includes('placeholder') && !keySecret.includes('placeholder'));

    if (!isSimulatorMode && !isRazorpayConfigured) {
      console.error('[Create Order] Razorpay credentials missing or placeholder in live mode.');
      return NextResponse.json({
        success: false,
        error: {
          code: 'PAYMENT_CONFIG_ERROR',
          message: 'Razorpay API credentials are not configured on the server. Please check .env.local variables.'
        }
      }, { status: 500 });
    }

    let orderId = '';

    if (isSimulatorMode && !isRazorpayConfigured) {
      // Offline Simulator Mode without Razorpay Keys
      orderId = `order_sim_${reg.id.substring(0, 8)}_${Date.now()}`;
      console.log(`[Create Order] Generated simulator order: ${orderId}`);
    } else {
      // Live or Test Razorpay Gateway Mode
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

    // 4. Save Payment record in database cleanly without duplicate crashes
    const { data: existingPayments, error: fetchPayError } = await supabaseAdmin
      .from('payments')
      .select('id, payment_status')
      .eq('registration_id', reg.id)
      .order('created_at', { ascending: false });

    if (fetchPayError) {
      console.error('[Create Order] Failed to query existing payments:', fetchPayError);
    }

    const timestamp = new Date().toISOString();

    if (existingPayments && existingPayments.length > 0) {
      const primaryPay = existingPayments[0];
      const { error: updateError } = await supabaseAdmin
        .from('payments')
        .update({
          razorpay_order_id: orderId,
          amount: amountInPaise,
          currency: 'INR',
          payment_status: 'PENDING',
          updated_at: timestamp
        })
        .eq('id', primaryPay.id);

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

      // If there are duplicate pending records, clean up redundant pending records
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
        payment_mode: isSimulatorMode ? 'simulator' : 'live',
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
        message: err.message || 'Something went wrong. Please try again later.'
      }
    }, { status: 500 });
  }
}

