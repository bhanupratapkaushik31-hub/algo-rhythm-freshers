-- Migration: Add payment simulator columns and update registrations view
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS failure_reason TEXT DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Update registrations_with_details View to include payment_method
CREATE OR REPLACE VIEW public.registrations_with_details AS
SELECT
    r.*,
    COALESCE(e.entry_status, 'NOT_ENTERED') AS entry_status,
    e.entry_time AS entry_time,
    e.scanned_by AS entry_scanned_by,
    p.razorpay_payment_id AS razorpay_payment_id,
    p.paid_at AS payment_time,
    p.payment_method AS payment_method
FROM public.registrations r
LEFT JOIN public.entries e ON r.id = e.registration_id
LEFT JOIN public.payments p ON r.id = p.registration_id AND p.payment_status = 'SUCCESS';
