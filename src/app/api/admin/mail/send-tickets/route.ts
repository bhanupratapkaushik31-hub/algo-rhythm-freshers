import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { sendTicketEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin permissions
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to send ticket emails.' }
      }, { status: 401 });
    }

    const body = await request.json();
    const { registrationIds } = body;

    if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Please provide at least one registration ID in registrationIds.' }
      }, { status: 400 });
    }

    // 2. Fetch registrations to be dispatched
    const { data: records, error: fetchErr } = await supabaseAdmin
      .from('registrations')
      .select('id, full_name, email, registration_status, ticket_token')
      .in('id', registrationIds);

    if (fetchErr || !records) {
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: fetchErr?.message || 'Failed to fetch registration records.' }
      }, { status: 500 });
    }

    const results: Array<{
      id: string;
      name: string;
      email: string;
      success: boolean;
      error?: string;
    }> = [];

    let sentCount = 0;
    let failedCount = 0;

    // 3. Process dispatch sequentially with a brief throttling pause (100ms) to avoid rate-limiting
    for (const reg of records) {
      if (reg.registration_status !== 'PAID') {
        results.push({
          id: reg.id,
          name: reg.full_name,
          email: reg.email,
          success: false,
          error: 'Registration is not marked as PAID.'
        });
        failedCount++;
        continue;
      }

      try {
        const success = await sendTicketEmail(reg.id, true);
        if (success) {
          sentCount++;
          results.push({
            id: reg.id,
            name: reg.full_name,
            email: reg.email,
            success: true
          });
        } else {
          failedCount++;
          results.push({
            id: reg.id,
            name: reg.full_name,
            email: reg.email,
            success: false,
            error: 'Delivery provider rejected or failed dispatch.'
          });
        }
      } catch (err: any) {
        failedCount++;
        results.push({
          id: reg.id,
          name: reg.full_name,
          email: reg.email,
          success: false,
          error: err.message || 'Unknown sending exception'
        });
      }

      // 1-second throttle interval to protect Gmail from rate limiting / spam bans
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return NextResponse.json({
      success: true,
      data: {
        totalRequested: registrationIds.length,
        totalProcessed: records.length,
        sent: sentCount,
        failed: failedCount,
        results
      }
    });

  } catch (err: any) {
    console.error('Bulk ticket dispatch API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
