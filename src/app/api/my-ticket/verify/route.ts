import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createTicketSession } from '@/lib/otp';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

function normalizePhone(phoneInput: string): string {
  const digits = phoneInput.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  return digits.slice(-10);
}

function normalizeSpacing(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting (max 15 verification attempts per minute per IP to prevent brute-force attacks)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, 'ticket-verify-details', { limit: 15, windowMs: 60000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many verification attempts. Please wait a minute before trying again.'
        }
      }, { status: 429 });
    }

    const body = await request.json();
    const { full_name, registration_number, email, phone } = body || {};

    const genericErrorResponse = {
      success: false,
      error: {
        code: 'DETAILS_MISMATCH',
        message: 'The details do not match any registered ticket. Please check your information and try again.'
      }
    };

    // 2. Validate that all 4 required fields are provided
    if (!full_name || !registration_number || !email || !phone ||
        typeof full_name !== 'string' ||
        typeof registration_number !== 'string' ||
        typeof email !== 'string' ||
        typeof phone !== 'string') {
      return NextResponse.json(genericErrorResponse, { status: 400 });
    }

    const cleanFullName = full_name.trim();
    const cleanRegNo = registration_number.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhone(phone);

    // Basic format checks
    if (!cleanFullName || !cleanRegNo || !cleanEmail || cleanPhone.length !== 10) {
      return NextResponse.json(genericErrorResponse, { status: 400 });
    }

    // 3. Search database for ONE registration where ALL 4 fields match the SAME record and status is PAID
    // Exact AND condition across registration_number, email, phone, and registration_status
    const { data: reg, error: fetchErr } = await supabaseAdmin
      .from('registrations')
      .select('id, full_name, registration_number, email, phone, registration_status, ticket_token, ticket_id')
      .ilike('registration_number', cleanRegNo)
      .ilike('email', cleanEmail)
      .eq('phone', cleanPhone)
      .eq('registration_status', 'PAID')
      .maybeSingle();

    if (fetchErr) {
      console.error('[Ticket Verification] Database query error:', fetchErr);
      return NextResponse.json(genericErrorResponse, { status: 400 });
    }

    if (!reg) {
      console.log(`[Ticket Verification] Details mismatch for RegNo: ${cleanRegNo}`);
      return NextResponse.json(genericErrorResponse, { status: 400 });
    }

    // Strict name verification on the matched record
    const dbNameNormalized = normalizeSpacing(reg.full_name || '');
    const inputNameNormalized = normalizeSpacing(cleanFullName);

    if (dbNameNormalized !== inputNameNormalized) {
      console.log(`[Ticket Verification] Name mismatch for RegNo: ${cleanRegNo}.`);
      return NextResponse.json(genericErrorResponse, { status: 400 });
    }

    // 4. All four details match the same paid registration record!
    // Create short-lived cryptographically signed session cookie bound strictly to this specific registration ID
    const sessionToken = createTicketSession(cleanPhone, [reg.id]);
    const isHttps = (request.nextUrl?.protocol === 'https:') || (typeof request.url === 'string' && request.url.startsWith('https:')) || process.env.NODE_ENV === 'production';

    const response = NextResponse.json({
      success: true,
      redirect: '/my-ticket'
    });

    response.cookies.set('ticket_access_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 7200 // 2 hours validity
    });

    response.cookies.set('student_ticket_token', reg.ticket_token, {
      path: '/',
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 7200
    });

    response.cookies.set('student_phone', cleanPhone, {
      path: '/',
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 7200
    });

    return response;

  } catch (err: any) {
    console.error('[Ticket Verification] Unhandled crash:', err);
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
