-- Migration: Add refund-related columns to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'NOT_REQUIRED',
ADD COLUMN IF NOT EXISTS refund_id TEXT,
ADD COLUMN IF NOT EXISTS refund_amount INTEGER,
ADD COLUMN IF NOT EXISTS refund_reason TEXT,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Re-create registrations_with_details View to include refund columns and join all payments
CREATE OR REPLACE VIEW public.registrations_with_details AS
SELECT
    r.*,
    COALESCE(e.entry_status, 'NOT_ENTERED') AS entry_status,
    e.entry_time AS entry_time,
    e.scanned_by AS entry_scanned_by,
    e.scanner_device AS entry_scanner_device,
    e.coordinator_id AS entry_coordinator_id,
    e.scanned_at AS entry_scanned_at,
    p.razorpay_payment_id AS razorpay_payment_id,
    p.razorpay_order_id AS razorpay_order_id,
    p.paid_at AS payment_time,
    p.payment_method AS payment_method,
    p.payment_status AS payment_status,
    p.refund_status AS refund_status,
    p.refund_id AS refund_id,
    p.refund_reason AS refund_reason,
    p.refund_amount AS refund_amount,
    p.refunded_at AS refunded_at
FROM public.registrations r
LEFT JOIN public.entries e ON r.id = e.registration_id
LEFT JOIN public.payments p ON r.id = p.registration_id;
