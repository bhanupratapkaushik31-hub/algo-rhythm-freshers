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

    // 2. Initialize Razorpay
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const amountInPaise = EVENT_CONFIG.registrationFeePaise;
    
    if (!keyId || !keySecret || keyId.includes('placeholder') || keySecret.includes('placeholder')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PAYMENT_CONFIG_ERROR',
          message: 'Razorpay API credentials are not configured on the server. Please check .env.local variables.'
        }
      }, { status: 500 });
    }

    let order: { id: string; amount: number; currency: string } = {
      id: '',
      amount: amountInPaise,
      currency: 'INR'
    };

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // 3. Create Razorpay Order
    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${reg.id.substring(0, 8)}`,
      notes: {
        registration_id: reg.id,
        registration_number: reg.registration_number,
        full_name: reg.full_name,
        email: reg.email,
      },
    };

    const realOrder = await razorpay.orders.create(orderOptions);
    order.id = realOrder.id;

    // 4. Save Payment record in database
    // Check if there is an existing payment record for this registration, update or insert
    const { data: existingPay } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('registration_id', reg.id)
      .maybeSingle();

    if (existingPay) {
      const { error: updateError } = await supabaseAdmin
        .from('payments')
        .update({
          razorpay_order_id: order.id,
          amount: amountInPaise,
          payment_status: 'PENDING',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPay.id);

      if (updateError) {
        console.error('Payment record update error:', updateError);
        return NextResponse.json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to record payment order.'
          }
        }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('payments')
        .insert({
          registration_id: reg.id,
          razorpay_order_id: order.id,
          amount: amountInPaise,
          payment_status: 'PENDING'
        });

      if (insertError) {
        console.error('Payment record insert error:', insertError);
        return NextResponse.json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to record payment order.'
          }
        }, { status: 500 });
      }
    }

    // 5. Return success with Order info and public Key ID
    return NextResponse.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: keyId,
        razorpay_configured: true,
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
    console.error('Create Order API error:', err);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Something went wrong. Please try again later.'
      }
    }, { status: 500 });
  }
}
