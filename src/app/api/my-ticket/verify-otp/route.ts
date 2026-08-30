import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeContact, verifyOtp, createTicketSession } from '@/lib/otp';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // 1. IP Rate Limiting (Max 15 verification attempts per 5 minutes per IP)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, 'otp-verify', { limit: 15, windowMs: 300000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many verification attempts. Please wait a few minutes before trying again.'
        }
      }, { status: 429 });
    }

    const body = await request.json();
    const rawContact = body?.phone || body?.mobile || body?.contact;
    const rawOtp = body?.otp;

    if (!rawContact || !rawOtp) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Contact and verification code are required.'
        }
      }, { status: 400 });
    }

    const { contact, type } = normalizeContact(rawContact);

    // 2. Verify OTP server-side
    const verification = await verifyOtp(contact, String(rawOtp));

    if (!verification.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: verification.error || 'VERIFICATION_FAILED',
          message: verification.message || 'Invalid or expired verification code.'
        }
      }, { status: 400 });
    }

    // 3. Find matching PAID registrations for this verified contact
    let query = supabaseAdmin
      .from('registrations')
      .select('id, ticket_token, phone, email')
      .eq('registration_status', 'PAID');

    if (type === 'phone') {
      query = query.eq('phone', contact);
    } else {
      query = query.eq('email', contact);
    }

    const { data: regs, error: fetchErr } = await query;

    if (fetchErr || !regs || regs.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_TICKETS_FOUND',
          message: 'No paid registrations found for this verified contact.'
        }
      }, { status: 404 });
    }

    // 4. Create cryptographically signed ticket session
    const regIds = regs.map((r: any) => r.id);
    const sessionToken = createTicketSession(contact, regIds);

    const response = NextResponse.json({
      success: true,
      count: regs.length,
      redirect: '/my-ticket'
    });

    const isHttps = process.env.NODE_ENV === 'production';

    // Set signed ticket session cookie (HttpOnly for maximum protection against XSS)
    response.cookies.set('ticket_access_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 // 2 hours
    });

    if (type === 'phone') {
      response.cookies.set('student_phone', contact, {
        path: '/',
        secure: isHttps,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60
      });
    }

    if (regs.length === 1) {
      response.cookies.set('student_ticket_token', regs[0].ticket_token, {
        path: '/',
        secure: isHttps,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60
      });
    } else {
      response.cookies.delete('student_ticket_token');
    }

    return response;

  } catch (err: any) {
    console.error('[Verify OTP API] Unhandled crash:', err);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong during verification. Please try again.'
      }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
