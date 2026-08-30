import { NextResponse } from 'next/server';

/**
 * OTP flow has been removed. Ticket access uses 4-field identity verification (/api/my-ticket/verify).
 */
export async function POST() {
  return NextResponse.json({
    success: false,
    error: {
      code: 'OTP_FLOW_REMOVED',
      message: 'OTP flow is removed. Please verify your ticket using your registration details.'
    }
  }, { status: 410 });
}

export const dynamic = 'force-dynamic';
