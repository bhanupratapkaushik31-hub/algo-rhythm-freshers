import { NextResponse } from 'next/server';

/**
 * Payment simulator is permanently disabled.
 * Only genuine Razorpay server-side webhook/checkout verification is permitted.
 */
export async function POST() {
  return NextResponse.json({
    success: false,
    error: {
      code: 'SIMULATOR_DISABLED',
      message: 'Payment simulation is permanently disabled. Real payment is required.'
    }
  }, { status: 403 });
}

export const dynamic = 'force-dynamic';
