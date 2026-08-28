import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function normalizePhoneNumber(phoneInput: string): string {
  // Strip all non-digit characters
  const digits = phoneInput.replace(/\D/g, '');
  
  // If it starts with 91 and has 12 digits, strip the 91 prefix
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  
  return digits;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    const genericResponse = {
      success: true,
      found: false,
      message: "If a registration exists for this number, you can retrieve your ticket."
    };

    if (!phone) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_PHONE', message: 'Phone number is required.' }
      }, { status: 400 });
    }

    const cleanPhone = normalizePhoneNumber(phone);

    // Validate 10 digit Indian mobile format
    if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_PHONE', message: 'Please enter a valid 10-digit mobile number.' }
      }, { status: 400 });
    }

    // Look up paid registrations matching this phone number
    const { data: regs, error: fetchErr } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('registration_status', 'PAID');

    if (fetchErr) {
      console.error('[Retrieve Ticket API] DB fetch error:', fetchErr);
      return NextResponse.json(genericResponse);
    }

    if (!regs || regs.length === 0) {
      console.log(`[Retrieve Ticket API] No paid registrations found for phone: ${cleanPhone}`);
      return NextResponse.json(genericResponse);
    }

    // Set cookie response
    const response = NextResponse.json({
      success: true,
      found: true
    });

    // Set cookie: student_phone
    response.cookies.set('student_phone', cleanPhone, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      sameSite: 'lax',
      secure: true
    });

    if (regs.length === 1) {
      // If exactly 1 ticket, auto-select it by setting student_ticket_token cookie
      response.cookies.set('student_ticket_token', regs[0].ticket_token, {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
        secure: true
      });
    } else {
      // If multiple, clear ticket token so user sees list of their tickets under this phone number
      response.cookies.delete('student_ticket_token');
    }

    return response;

  } catch (err: any) {
    console.error('[Retrieve Ticket API] Unhandled crash:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Server crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
