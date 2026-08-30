import { NextResponse } from 'next/server';

/**
 * SECURITY HARDENING: Direct phone-only ticket retrieval is permanently disabled.
 * All ticket retrievals must authenticate via /api/my-ticket/send-otp and /api/my-ticket/verify-otp.
 */
export async function POST() {
  return NextResponse.json({
    success: false,
    error: {
      code: 'OTP_REQUIRED',
      message: 'Direct phone retrieval is disabled for security. Verification code required.'
    }
  }, { status: 403 });
}

export const dynamic = 'force-dynamic';
