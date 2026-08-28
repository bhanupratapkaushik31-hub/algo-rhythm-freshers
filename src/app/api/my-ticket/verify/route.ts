import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-jwt-secret-fallback';

function verifyToken(token: string): string | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const { payload, signature } = JSON.parse(raw);
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const { email, exp } = JSON.parse(payload);
    if (Date.now() > exp) {
      return null;
    }
    
    return email;
  } catch (e) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!token) {
    return NextResponse.redirect(`${appUrl}/my-ticket?error=invalid_token`);
  }

  const email = verifyToken(token);
  if (!email) {
    return NextResponse.redirect(`${appUrl}/my-ticket?error=expired_token`);
  }

  try {
    // Lookup registrations for this verified email
    const { data: regs, error: fetchErr } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('email', email)
      .eq('registration_status', 'PAID');

    if (fetchErr || !regs || regs.length === 0) {
      console.warn(`[Verify Endpoint] Verification successful for ${email} but no paid registrations found in DB.`);
      return NextResponse.redirect(`${appUrl}/my-ticket?error=no_registration`);
    }

    const response = NextResponse.redirect(`${appUrl}/my-ticket`);

    // Set cookie: student_email
    response.cookies.set('student_email', email, {
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
      // If multiple, clear ticket token so user sees list of their tickets under this email
      response.cookies.delete('student_ticket_token');
    }

    return response;

  } catch (err) {
    console.error('[Verify Endpoint] Exception:', err);
    return NextResponse.redirect(`${appUrl}/my-ticket?error=server_error`);
  }
}

export const dynamic = 'force-dynamic';
