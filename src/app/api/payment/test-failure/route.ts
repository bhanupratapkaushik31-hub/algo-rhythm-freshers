import { NextResponse } from 'next/server';

/**
 * Payment simulator is permanently disabled.
 */
export async function POST() {
  return NextResponse.json({
    success: false,
    error: {
      code: 'SIMULATOR_DISABLED',
      message: 'Payment simulation is permanently disabled.'
    }
  }, { status: 403 });
}

export const dynamic = 'force-dynamic';
