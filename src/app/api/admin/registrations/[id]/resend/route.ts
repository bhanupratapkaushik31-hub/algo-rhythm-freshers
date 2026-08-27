import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { sendTicketEmail } from '@/lib/email';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. Verify admin permissions
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to send emails.' }
      }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Registration ID is required.' }
      }, { status: 400 });
    }

    // 2. Trigger force send email
    const emailSent = await sendTicketEmail(id, true);

    if (!emailSent) {
      return NextResponse.json({
        success: false,
        error: { code: 'EMAIL_FAILED', message: 'Resend API rejected the email or is not configured. Check database logs for error details.' }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Ticket email resent successfully.'
    });

  } catch (err: any) {
    console.error('Email resend API error:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
