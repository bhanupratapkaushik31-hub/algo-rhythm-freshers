import Razorpay from 'razorpay';
import { supabaseAdmin } from './supabaseAdmin';
import { sendRefundEmail } from './email';

export async function initiateAutoRefund(
  paymentId: string,
  registrationId: string | null,
  reason: string,
  studentDetails?: { name: string; registrationNumber: string; email: string }
) {
  console.log(`[Refund] Initiating auto-refund for Payment ID: ${paymentId}. Reason: ${reason}`);

  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID?.trim() || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET?.trim() || '',
    });

    // 1. Fetch payment details from Razorpay to verify state
    const paymentDetails = await razorpay.payments.fetch(paymentId);
    if (!paymentDetails || paymentDetails.status !== 'captured') {
      console.warn(`[Refund] Payment ${paymentId} status is ${paymentDetails?.status}, not captured. Cannot refund.`);
      return { success: false, error: 'Payment is not captured.' };
    }

    if (paymentDetails.refund_status === 'full') {
      console.warn(`[Refund] Payment ${paymentId} is already fully refunded.`);
      return { success: true, message: 'Already refunded.' };
    }

    // 2. Update payment status to PROCESSING in Supabase
    await safeUpdatePayment(paymentId, {
      refund_status: 'PROCESSING',
      refund_reason: reason,
      updated_at: new Date().toISOString()
    });

    // 3. Request Razorpay Refund API
    // Use the payment ID as notes to help idempotency
    const refund = await razorpay.payments.refund(paymentId, {
      amount: paymentDetails.amount, // Full refund
      notes: {
        reason: reason,
        registration_id: registrationId || 'UNKNOWN'
      }
    });

    const timestamp = new Date().toISOString();

    // 4. Update Database to REFUNDED
    await safeUpdatePayment(paymentId, {
      payment_status: 'FAILED',
      refund_status: 'REFUNDED',
      refund_id: refund.id,
      refund_amount: (refund.amount || paymentDetails.amount) as number,
      refunded_at: timestamp,
      updated_at: timestamp
    });

    // Update registration status if present
    if (registrationId) {
      await supabaseAdmin
        .from('registrations')
        .update({
          registration_status: 'PENDING',
          updated_at: timestamp
        })
        .eq('id', registrationId);
    }

    // 5. Send Refund Notification Email to Student
    const studentEmail = studentDetails?.email || paymentDetails.email;
    if (studentEmail) {
      await sendRefundEmail({
        email: studentEmail,
        name: studentDetails?.name || paymentDetails.notes?.name || 'Student',
        registrationNumber: studentDetails?.registrationNumber || paymentDetails.notes?.registration_number || 'N/A',
        paymentId: paymentId,
        refundId: refund.id,
        amount: (((refund.amount || paymentDetails.amount) as number) / 100).toFixed(2),
        reason: reason
      });
    }

    return { success: true, refundId: refund.id };

  } catch (err: any) {
    console.error(`[Refund Error] Auto-refund failed for Payment ${paymentId}:`, err);
    await safeUpdatePayment(paymentId, {
      refund_status: 'FAILED',
      refund_reason: `Refund error: ${err.message || 'Unknown error'}`,
      updated_at: new Date().toISOString()
    });
    return { success: false, error: err.message };
  }
}

async function safeUpdatePayment(paymentId: string, payload: any) {
  try {
    const { error } = await supabaseAdmin
      .from('payments')
      .update(payload)
      .eq('razorpay_payment_id', paymentId);
    
    if (error && (error.message.includes('column') || error.code === 'PGRST102')) {
      console.warn(`[Safe DB] Columns not found in database. Retrying payment update without refund fields.`);
      const safePayload: any = {};
      if (payload.payment_status) safePayload.payment_status = payload.payment_status;
      if (payload.updated_at) safePayload.updated_at = payload.updated_at;
      
      await supabaseAdmin
        .from('payments')
        .update(safePayload)
        .eq('razorpay_payment_id', paymentId);
    }
  } catch (dbErr) {
    console.error('[Safe DB] Failed to update payment:', dbErr);
  }
}
