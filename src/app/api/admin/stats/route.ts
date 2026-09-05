import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { EVENT_CONFIG } from '@/config/event';

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

    // 2. Auto-expire pending registrations older than 15 minutes to keep stats clean
    try {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      await supabaseAdmin
        .from('registrations')
        .update({ 
          registration_status: 'CANCELLED',
          updated_at: new Date().toISOString()
        })
        .eq('registration_status', 'PENDING')
        .lt('created_at', fifteenMinsAgo);
    } catch (cleanupErr) {
      console.warn('Auto-expire pending registrations cleanup warning:', cleanupErr);
    }

    // 3. Helper to build query filtering out soft-deleted registrations
    // Uses registration_status != CANCELLED by default, which works 100% without running any SQL migration
    const [
      { count: totalReg, error: err1 },
      { count: paidReg, error: err2 },
      { count: pendingReg, error: err3 },
      { count: failedPayments, error: errPayments },
      { count: modelingYes, error: errModelingYes },
      { count: modelingMale, error: errModelingMale },
      { count: modelingFemale, error: errModelingFemale },
      { count: modelingNo, error: errModelingNo },
      { count: emailsSent, error: errEmailsSent },
      { count: emailsFailed, error: errEmailsFailed },
      { count: liveEntriesCount, error: errEntries },
      { data: paidRegsData, error: errPaidRegs }
    ] = await Promise.all([
      // Total Active Registrations
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).neq('registration_status', 'CANCELLED'),
      // Paid Registrations
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('registration_status', 'PAID'),
      // Pending Registrations
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('registration_status', 'PENDING'),
      // Failed Payments
      supabaseAdmin.from('payments').select('*', { count: 'exact', head: true }).eq('payment_status', 'FAILED'),
      // Modeling - Yes (Total Enrolled)
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).neq('modeling', 'No').neq('registration_status', 'CANCELLED'),
      // Modeling - Male
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).or('modeling.eq.Male,modeling.ilike.%Male%,modeling.eq.Yes - Male').neq('registration_status', 'CANCELLED'),
      // Modeling - Female
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).or('modeling.eq.Female,modeling.ilike.%Female%,modeling.eq.Yes - Female').neq('registration_status', 'CANCELLED'),
      // Modeling - No
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('modeling', 'No').neq('registration_status', 'CANCELLED'),
      // Emails - Sent
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('email_status', 'SENT'),
      // Emails - Failed
      supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('email_status', 'FAILED'),
      // Entries Completed (Live check-ins)
      supabaseAdmin.from('entries').select('*', { count: 'exact', head: true }).eq('entry_status', 'ENTERED'),
      // Paid registrations list to calculate accurate Total Collection
      supabaseAdmin.from('registrations').select('id, year, registration_number').eq('registration_status', 'PAID')
    ]);

    const finalTotalReg = totalReg;
    const finalPaidReg = paidReg;
    const finalPendingReg = pendingReg;
    const finalModelingYes = modelingYes;
    let finalModelingMale = modelingMale || 0;
    let finalModelingFemale = modelingFemale || 0;
    const finalModelingNo = modelingNo;
    const finalEmailsSent = emailsSent;
    const finalEmailsFailed = emailsFailed;
    const finalPaidRegsData = paidRegsData;

    // Additional resilience: check if gender column exists and was used for gender selection
    if (finalModelingMale === 0 && finalModelingFemale === 0) {
      try {
        const [mGenderRes, fGenderRes] = await Promise.all([
          supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('gender', 'Male').neq('modeling', 'No').neq('registration_status', 'CANCELLED'),
          supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }).eq('gender', 'Female').neq('modeling', 'No').neq('registration_status', 'CANCELLED'),
        ]);
        if (!mGenderRes?.error && typeof mGenderRes?.count === 'number') {
          finalModelingMale = mGenderRes.count;
        }
        if (!fGenderRes?.error && typeof fGenderRes?.count === 'number') {
          finalModelingFemale = fGenderRes.count;
        }
      } catch (err) {
        // Silently catch in case gender column does not exist
      }
    }

    let entriesCompleted = 0;
    if (!errEntries) {
      entriesCompleted = liveEntriesCount || 0;
    }

    // Calculate accurate total collection strictly from valid active paid registrations
    let totalCollection = 0;
    if (finalPaidRegsData && finalPaidRegsData.length > 0) {
      const paidIds = finalPaidRegsData.map((r: any) => r.id);
      const { data: matchedPayments } = await supabaseAdmin
        .from('payments')
        .select('registration_id, amount')
        .in('registration_id', paidIds)
        .eq('payment_status', 'SUCCESS');

      const paymentMap = new Map<string, number>();
      if (matchedPayments) {
        matchedPayments.forEach((p: any) => {
          // If amount is stored in paise (e.g. 10000 or 20000), convert to INR
          const amtInr = p.amount >= 1000 ? p.amount / 100 : p.amount;
          paymentMap.set(p.registration_id, amtInr);
        });
      }

      totalCollection = finalPaidRegsData.reduce((sum: number, reg: any) => {
        if (paymentMap.has(reg.id)) {
          return sum + (paymentMap.get(reg.id) || 0);
        }
        // Fallback to configured year fee (1st Year: ₹100, 2nd Year: ₹200)
        const fee = EVENT_CONFIG.getFeeForYear(reg.year || EVENT_CONFIG.getYearFromRegNo(reg.registration_number)).inr;
        return sum + fee;
      }, 0);
    }

    const paidCount = finalPaidReg || 0;
    const enteredCount = entriesCompleted || 0;
    const notEnteredCount = Math.max(0, paidCount - enteredCount);

    // Calculate 2.5% payment deductions
    const deductionRate = 0.025;
    const deductionsAmount = Number((totalCollection * deductionRate).toFixed(2));
    const paymentAfterDeductions = Number((totalCollection * (1 - deductionRate)).toFixed(2));

    return NextResponse.json({
      success: true,
      data: {
        total_registrations: finalTotalReg || 0,
        paid_registrations: paidCount,
        pending_payments: finalPendingReg || 0,
        failed_payments: failedPayments || 0,
        modeling_yes: finalModelingYes || 0,
        modeling_male: finalModelingMale || 0,
        modeling_female: finalModelingFemale || 0,
        modeling_no: finalModelingNo || 0,
        tickets_generated: paidCount,
        emails_sent: finalEmailsSent || 0,
        emails_failed: finalEmailsFailed || 0,
        entries_completed: enteredCount,
        not_yet_entered: notEnteredCount,
        total_collection: totalCollection,
        deductions_amount: deductionsAmount,
        payment_after_deductions: paymentAfterDeductions
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


