import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendMagicLinkEmail } from '@/lib/email';
import crypto from 'crypto';

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-jwt-secret-fallback';

function generateToken(email: string): string {
  const payload = JSON.stringify({
    email,
    exp: Date.now() + 15 * 60 * 1000 // 15 minutes
  });
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    const genericResponse = {
      success: true,
      message: "If a registration exists for this email, you'll receive a verification link."
    };

    if (!email || !email.includes('@')) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Please provide a valid email address.' }
      }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check if there are registrations under this email with PAID status
    const { data: regs, error: fetchErr } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('email', cleanEmail)
      .eq('registration_status', 'PAID');

    if (fetchErr) {
      console.error('[Send Link Endpoint] DB fetch error:', fetchErr);
      return NextResponse.json(genericResponse);
    }

    if (!regs || regs.length === 0) {
      console.log(`[Send Link Endpoint] No paid registrations found for email: ${cleanEmail}`);
      return NextResponse.json(genericResponse);
    }

    // 2. Generate secure signed verification token
    const token = generateToken(cleanEmail);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verifyLink = `${appUrl}/api/my-ticket/verify?token=${token}`;

    // 3. Send magic link email to the student
    const studentName = regs[0].full_name || 'Student';
    console.log(`[Send Link Endpoint] Sending magic link to ${cleanEmail}...`);
    const emailSent = await sendMagicLinkEmail(cleanEmail, studentName, verifyLink);

    if (!emailSent) {
      console.error('[Send Link Endpoint] Failed to send email via SMTP transporter.');
      // Return 200 generic message anyway to not reveal system error, but log it internally.
    }

    return NextResponse.json(genericResponse);

  } catch (err: any) {
    console.error('[Send Link Endpoint] Unhandled crash:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Server crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
