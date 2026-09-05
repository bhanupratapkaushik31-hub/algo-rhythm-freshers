import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { registerSchema } from '@/lib/schemas';
import { EVENT_CONFIG } from '@/config/event';
import crypto from 'crypto';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // 0. Rate limiting (max 10 registrations per minute per IP)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, 'register', { limit: 10, windowMs: 60000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many registration attempts. Please wait a minute before trying again.'
        }
      }, { status: 429 });
    }

    const body = await request.json();
    
    // 1. Validate Input (includes cross-field modeling/modeling_talent check via superRefine)
    const parseResult = registerSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message
        }
      }, { status: 400 });
    }

    const data = parseResult.data;

    // Validate registration number eligibility
    const regError = EVENT_CONFIG.getRegNoValidationError(data.registration_number);
    if (regError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INELIGIBLE_REGISTRATION',
          message: regError
        }
      }, { status: 400 });
    }

    if (!data.photo_path) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please upload your photo before checking out.'
        }
      }, { status: 400 });
    }

    // Automatically determine academic year from registration number (125 -> 2nd Year, 126 -> 1st Year)
    const detectedYear = EVENT_CONFIG.getYearFromRegNo(data.registration_number);
    const computedYear: string = detectedYear || '1st Year';

    // 2. Server-side enforcement of modeling_talent logic
    // ALWAYS force null if modeling is No, regardless of what client sends.
    // If modeling is enrolled (Yes / Male / Female) but talent is blank/missing, reject.
    const isModelingEnrolled = data.modeling && data.modeling !== 'No';
    const modeling_talent: string | null = isModelingEnrolled
      ? (data.modeling_talent?.trim() || null)
      : null;

    if (isModelingEnrolled && !modeling_talent) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please tell us about your talent or what you would like to perform.'
        }
      }, { status: 400 });
    }

    // 3. Check if registration is open
    const { data: statusSetting, error: settingsError } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'registration_status')
      .single();

    if (settingsError) {
      console.error('Settings fetch error:', settingsError);
    }

    const isOpen = statusSetting ? (statusSetting.value as any).open : true;
    if (!isOpen) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'REGISTRATION_CLOSED',
          message: 'Registrations for ALGO-RHYTHM 2K26 are currently closed.'
        }
      }, { status: 403 });
    }

    // 4. Check for existing registration
    const { data: existingReg, error: fetchError } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('registration_number', data.registration_number)
      .maybeSingle();

    if (fetchError) {
      console.error('Database fetch error:', fetchError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Something went wrong. Please try again later.'
        }
      }, { status: 500 });
    }

    if (existingReg) {
      if (existingReg.registration_status === 'PAID') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'REGISTRATION_EXISTS',
            message: 'An account/ticket already exists for this registration number. If you have already completed payment, please use your existing ticket.'
          }
        }, { status: 400 });
      } else {
        // If it's PENDING or CANCELLED (or unpaid), update the details and reactivate to PENDING
        const updatePayload: Record<string, any> = {
          full_name: data.full_name,
          year: computedYear,
          school_name: data.school_name,
          modeling: data.modeling,
          phone: data.phone,
          email: data.email,
          photo_path: data.photo_path,
          registration_status: 'PENDING',
          updated_at: new Date().toISOString()
        };

        if (modeling_talent !== undefined) {
          updatePayload.modeling_talent = modeling_talent;
        }

        let updatedReg: any = null;

        // 1. Try updating with standard payload
        const { data: resData, error: updateError } = await supabaseAdmin
          .from('registrations')
          .update(updatePayload)
          .eq('id', existingReg.id)
          .select()
          .maybeSingle();

        if (updateError) {
          console.warn('Database update initial attempt warning/error:', updateError);

          // Handle unique constraint violations (e.g. phone/email duplication)
          if (updateError.code === '23505') {
            const errorMsg = updateError.message?.toLowerCase() || '';
            let userMsg = 'A registration with this email or phone number already exists.';
            if (errorMsg.includes('phone')) {
              userMsg = 'This phone number is already registered for another attendee.';
            } else if (errorMsg.includes('email')) {
              userMsg = 'This email address is already registered for another attendee.';
            }
            return NextResponse.json({
              success: false,
              error: {
                code: 'DUPLICATE_CONTACT',
                message: userMsg
              }
            }, { status: 400 });
          }

          // Fallback: If update failed due to optional column mismatch, try bare core fields
          const barePayload = {
            full_name: data.full_name,
            year: computedYear,
            school_name: data.school_name,
            modeling: data.modeling,
            phone: data.phone,
            email: data.email,
            photo_path: data.photo_path,
            registration_status: 'PENDING'
          };

          const { data: fallbackData, error: fallbackError } = await supabaseAdmin
            .from('registrations')
            .update(barePayload)
            .eq('id', existingReg.id)
            .select()
            .maybeSingle();

          if (fallbackError) {
            console.error('Database fallback update error:', fallbackError);
            // If even bare update fails, fall back to existing record so student is never stuck
            updatedReg = { ...existingReg, ...barePayload };
          } else {
            updatedReg = fallbackData;
          }
        } else {
          updatedReg = resData;
        }

        if (!updatedReg) {
          updatedReg = existingReg;
        }

        // Ensure payment record exists and is set to PENDING with matching year fee (re-enabling failed/cancelled sessions)
        try {
          const feePaise = EVENT_CONFIG.getFeeForYear(updatedReg.year || computedYear).paise;
          const { data: existingPays } = await supabaseAdmin
            .from('payments')
            .select('id, amount, payment_status')
            .eq('registration_id', updatedReg.id)
            .order('created_at', { ascending: false });

          if (!existingPays || existingPays.length === 0) {
            await supabaseAdmin
              .from('payments')
              .insert({
                registration_id: updatedReg.id,
                razorpay_order_id: `order_pending_${updatedReg.id.substring(0, 8)}`,
                amount: feePaise,
                currency: 'INR',
                payment_status: 'PENDING'
              });
          } else {
            const latestPay = existingPays[0];
            // If payment was FAILED, CANCELLED, or PENDING with wrong amount, reactivate it to PENDING with current fee
            if (latestPay.payment_status !== 'SUCCESS') {
              await supabaseAdmin
                .from('payments')
                .update({
                  amount: feePaise,
                  payment_status: 'PENDING',
                  updated_at: new Date().toISOString()
                })
                .eq('id', latestPay.id);
            }
          }
        } catch (payErr) {
          console.error('Error ensuring payment record for updated registration:', payErr);
        }

        return NextResponse.json({
          success: true,
          data: updatedReg
        });
      }
    }

    // 5. Create new registration
    const ticketToken = crypto.randomBytes(24).toString('hex');
    const { data: newReg, error: insertError } = await supabaseAdmin
      .from('registrations')
      .insert({
        registration_number: data.registration_number,
        full_name: data.full_name,
        year: computedYear,
        school_name: data.school_name,
        modeling: data.modeling,
        modeling_talent: modeling_talent,
        phone: data.phone,
        email: data.email,
        photo_path: data.photo_path,
        ticket_token: ticketToken,
        registration_status: 'PENDING'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      // Double check unique constraint violation code
      if (insertError.code === '23505') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'REGISTRATION_EXISTS',
            message: 'This registration number is already registered.'
          }
        }, { status: 400 });
      }
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to create registration. Please try again.'
        }
      }, { status: 500 });
    }

    // Initialize payment record as PENDING with fee matching student's year
    try {
      const initialFeePaise = EVENT_CONFIG.getFeeForYear(newReg.year).paise;
      await supabaseAdmin
        .from('payments')
        .insert({
          registration_id: newReg.id,
          razorpay_order_id: `order_pending_${newReg.id.substring(0, 8)}`,
          amount: initialFeePaise,
          currency: 'INR',
          payment_status: 'PENDING'
        });
    } catch (payErr) {
      console.error('Failed to initialize payment record for registration:', newReg.id, payErr);
    }

    return NextResponse.json({
      success: true,
      data: newReg
    });

  } catch (err) {
    console.error('Registration API error:', err);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong on our side. Please try again later.'
      }
    }, { status: 500 });
  }
}
