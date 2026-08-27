import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication for any registered role
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin', 'scanner', 'coordinator']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authenticated.' }
      }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: admin
    });

  } catch (err: any) {
    console.error('Profile API error:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
