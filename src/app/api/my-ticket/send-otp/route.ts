import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeContact, generateAndStoreOtp } from '@/lib/otp';
import { sendMobileOtp } from '@/lib/sms';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // 1. IP Rate Limiting (Max 6 OTP requests per 10 minutes per IP)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, 'mobile-otp-request', { limit: 6, windowMs: 600000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many verification requests. Please wait a few minutes before trying again.'
        }
      }, { status: 429 });
    }

    const body = await request.json();
    const rawMobile = body?.phone || body?.mobile || body?.contact;

    if (!rawMobile || typeof rawMobile !== 'string') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_MOBILE',
          message: 'Please enter your registered 10-digit mobile number.'
        }
      }, { status: 400 });
    }

    const { contact: cleanPhone } = normalizeContact(rawMobile);

    // Strict 10-digit Indian Mobile format check
    if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PHONE',
          message: 'Please enter a valid 10-digit Indian mobile number.'
        }
      }, { status: 400 });
    }

    // Generic response to prevent phone number enumeration
    const genericSuccess = {
      success: true,
      message: 'OTP sent if a registered account exists.',
      phone: cleanPhone
    };

    // 2. Lookup paid registrations matching this mobile number
    const { data: regs, error: fetchErr } = await supabaseAdmin
      .from('registrations')
      .select('id, phone')
      .eq('phone', cleanPhone)
      .eq('registration_status', 'PAID');

    if (fetchErr) {
      console.error('[Send Mobile OTP] DB query error:', fetchErr);
      return NextResponse.json(genericSuccess);
    }

    // Anti-enumeration: If no registered attendee, return generic response without generating OTP
    if (!regs || regs.length === 0) {
      console.log(`[Send Mobile OTP] No paid registrations found for mobile: ${cleanPhone}`);
      return NextResponse.json(genericSuccess);
    }

    // 3. Generate & Store Cryptographically Secure Hashed OTP
    const otpResult = await generateAndStoreOtp(cleanPhone, 'phone');

    if (!otpResult.success) {
      if (otpResult.error === 'COOLDOWN_ACTIVE') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'COOLDOWN_ACTIVE',
            message: `Please wait ${otpResult.cooldownSeconds}s before requesting a new OTP.`
          },
          cooldownSeconds: otpResult.cooldownSeconds
        }, { status: 429 });
      }

      return NextResponse.json({
        success: false,
        error: {
          code: 'OTP_FAILED',
          message: 'Unable to send OTP right now. Please try again.'
        }
      }, { status: 500 });
    }

    // 4. Send Mobile OTP to the registered mobile number
    await sendMobileOtp(cleanPhone, otpResult.otp!);

    return NextResponse.json({
      success: true,
      message: 'OTP sent if a registered account exists.',
      phone: cleanPhone
    });

  } catch (err: any) {
    console.error('[Send Mobile OTP] Unhandled crash:', err);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.'
      }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
