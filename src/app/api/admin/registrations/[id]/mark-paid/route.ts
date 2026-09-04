import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { EVENT_CONFIG } from '@/config/event';
import { sendTicketEmail } from '@/lib/email';

// POST: Mark a registration as PAID, restore it if soft-deleted, ensure payment record, and dispatch ticket email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Verify admin permissions (Super Admin or Admin)
    const admin = await verifyAdminAuth(request, ['super_admin', 'admin']);
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You are not authorized to mark registrations as paid.' }
      }, { status: 403 });
    }

    // 2. Fetch existing registration
    const { data: reg, error: fetchErr } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[Mark as Paid] DB fetch error:', fetchErr);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to retrieve registration record.' }
      }, { status: 500 });
    }

    if (!reg) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Registration record not found.' }
      }, { status: 404 });
    }

    const timestamp = new Date().toISOString();
    const resolvedYear = EVENT_CONFIG.getYearFromRegNo(reg.registration_number) || reg.year || '1st Year';
    const feePaise = EVENT_CONFIG.getFeeForYear(resolvedYear).paise;

    // 3. Ensure token and ticket_id exist
    const ticketToken = reg.ticket_token || crypto.randomBytes(24).toString('hex');
    const ticketId = reg.ticket_id || `ALG26-CSE-${String(Math.floor(1000 + Math.random() * 9000))}`;

    // 4. Update registration to PAID and clear soft-deletion
    const { data: updatedReg, error: regUpdateErr } = await supabaseAdmin
      .from('registrations')
      .update({
        registration_status: 'PAID',
        ticket_token: ticketToken,
        ticket_id: ticketId,
        deleted_at: null,
        is_deleted: false,
        updated_at: timestamp
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (regUpdateErr) {
      console.error('[Mark as Paid] Registration update error:', regUpdateErr);
      return NextResponse.json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update registration status to PAID.' }
      }, { status: 500 });
    }

    // 5. Ensure payment record exists and is marked as SUCCESS
    const { data: existingPay } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('registration_id', id)
      .maybeSingle();

    const manualPayId = `MANUAL_ADMIN_${id.substring(0, 8)}_${Date.now()}`;

    if (existingPay) {
      const { error: payUpdateErr } = await supabaseAdmin
        .from('payments')
        .update({
          payment_status: 'SUCCESS',
          payment_method: existingPay.payment_method || 'MANUAL_ADMIN',
          razorpay_payment_id: existingPay.razorpay_payment_id || manualPayId,
          amount: existingPay.amount || feePaise,
          paid_at: existingPay.paid_at || timestamp,
          updated_at: timestamp
        })
        .eq('id', existingPay.id);

      if (payUpdateErr) {
        console.warn('[Mark as Paid] Warning updating existing payment:', payUpdateErr);
      }
    } else {
      const { error: payInsertErr } = await supabaseAdmin
        .from('payments')
        .insert({
          registration_id: id,
          amount: feePaise,
          currency: 'INR',
          payment_status: 'SUCCESS',
          payment_method: 'MANUAL_ADMIN',
          razorpay_payment_id: manualPayId,
          razorpay_order_id: `order_manual_${id.substring(0, 8)}`,
          paid_at: timestamp,
          created_at: timestamp,
          updated_at: timestamp
        });

      if (payInsertErr) {
        console.warn('[Mark as Paid] Warning creating payment record:', payInsertErr);
      }
    }

    // 6. Send transactional ticket email with QR code
    let emailSent = false;
    let emailError: string | null = null;
    try {
      emailSent = await sendTicketEmail(id, true);
    } catch (err: any) {
      console.error('[Mark as Paid] Failed to dispatch ticket email:', err);
      emailError = err.message || 'Email delivery failed.';
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Registration marked as PAID, restored to active attendees, and ticket email dispatched.',
        registration: updatedReg || reg,
        email_sent: emailSent,
        email_error: emailError
      }
    });

  } catch (err: any) {
    console.error('[Mark as Paid] Route crashed:', err);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Internal server error occurred.' }
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
