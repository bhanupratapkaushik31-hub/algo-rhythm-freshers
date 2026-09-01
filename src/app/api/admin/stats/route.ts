import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    // 1. Verify admin permissions
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to view admin statistics.' }
      }, { status: 401 });
    }

    // 2. Fetch all required counts concurrently in parallel
    const [
      { count: totalReg, error: err1 },
      { count: paidReg, error: err2 },
      { count: pendingReg, error: err3 },
      { count: failedPayments, error: errPayments },
      { count: modelingYes, error: errModelingYes },
      { count: modelingNo, error: errModelingNo },
      { count: emailsSent, error: errEmailsSent },
      { count: emailsFailed, error: errEmailsFailed },
      { count: liveEntriesCount, error: errEntries },
      { data: paymentsData, error: err4 }
    ] = await Promise.all([
      // Total Registrations
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }),
      // Paid Registrations
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('registration_status', 'PAID'),
      // Pending Registrations
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('registration_status', 'PENDING'),
      // Failed Payments
      supabaseAdmin.from('payments').select('*', { count: 'exact', head: true }).eq('payment_status', 'FAILED'),
      // Modeling - Yes
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('modeling', 'Yes'),
      // Modeling - No
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('modeling', 'No'),
      // Emails - Sent
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('email_status', 'SENT'),
      // Emails - Failed
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('email_status', 'FAILED'),
      // Entries Completed (Live check-ins)
      supabaseAdmin.from('entries').select('*', { count: 'exact', head: true }).eq('entry_status', 'ENTERED'),
      // Total Collection (Revenue calculation from successful payments)
      supabaseAdmin.from('payments').select('amount').eq('payment_status', 'SUCCESS')
    ]);

    let entriesCompleted = 0;
    if (!errEntries) {
      entriesCompleted = liveEntriesCount || 0;
    }

    // Error handling
    if (err1 || err2 || err3 || errPayments || errModelingYes || errModelingNo || errEmailsSent || errEmailsFailed || errEntries || err4) {
      console.error('Stats compile DB errors:', { err1, err2, err3, errPayments, errModelingYes, errModelingNo, errEmailsSent, errEmailsFailed, errEntries, err4 });
      return NextResponse.json({
        success: false,
        error: { 
          code: 'DATABASE_ERROR', 
          message: `Failed to compile statistics. (Detail: ${errEntries?.message || 'Database error'}). Ensure you have run the latest SQL migrations in your Supabase SQL Editor.` 
        }
      }, { status: 500 });
    }

    const totalCollectionPaise = paymentsData?.reduce((sum: number, item: any) => sum + item.amount, 0) || 0;
    const totalCollection = totalCollectionPaise / 100; // Convert to INR

    const paidCount = paidReg || 0;
    const enteredCount = entriesCompleted || 0;
    const notEnteredCount = Math.max(0, paidCount - enteredCount);

    return NextResponse.json({
      success: true,
      data: {
        total_registrations: totalReg || 0,
        paid_registrations: paidCount,
        pending_payments: pendingReg || 0,
        failed_payments: failedPayments || 0,
        modeling_yes: modelingYes || 0,
        modeling_no: modelingNo || 0,
        tickets_generated: paidCount, // tickets are generated upon successful payment
        emails_sent: emailsSent || 0,
        emails_failed: emailsFailed || 0,
        entries_completed: enteredCount,
        not_yet_entered: notEnteredCount,
        total_collection: totalCollection
      }
    });

  } catch (err: any) {
    console.error('Stats API crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Crashed' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
