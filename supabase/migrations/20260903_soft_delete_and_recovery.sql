-- =========================================================================
-- ALGO-RHYTHM 2K26: SOFT DELETE AND RECOVERY SYSTEM MIGRATION
-- Migration Date: 2026-09-03
-- Safe, Idempotent, Non-destructive to existing student records
-- =========================================================================

BEGIN;

-- 1. Add deleted_at and is_deleted columns to registrations
ALTER TABLE public.registrations 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. Add performance index on deleted flags
CREATE INDEX IF NOT EXISTS idx_registrations_deleted_at 
    ON public.registrations(deleted_at);

CREATE INDEX IF NOT EXISTS idx_registrations_is_deleted 
    ON public.registrations(is_deleted);

-- 3. Update the unified registrations_with_details view to include deleted columns
CREATE OR REPLACE VIEW public.registrations_with_details
WITH (security_invoker = true)
AS
SELECT
    r.id,
    r.ticket_id,
    r.ticket_token,
    r.registration_number,
    r.full_name,
    r.year,
    r.school_name,
    r.modeling,
    r.phone,
    r.email,
    r.registration_status,
    r.email_sent,
    r.created_at,
    r.updated_at,
    r.email_status,
    r.email_error,
    r.email_sent_at,
    r.photo_path,
    r.deleted_at,
    r.is_deleted,

    -- Entry details
    COALESCE(e.entry_status, 'NOT_ENTERED') AS entry_status,
    e.entry_time AS entry_time,
    e.scanned_by AS entry_scanned_by,
    e.scanner_device AS entry_scanner_device,
    e.coordinator_id AS entry_coordinator_id,
    e.scanned_at AS entry_scanned_at,
    e.is_test AS entry_is_test,

    -- Payment details
    p.razorpay_payment_id AS razorpay_payment_id,
    p.razorpay_order_id AS razorpay_order_id,
    p.paid_at AS payment_time,
    p.payment_method AS payment_method,
    p.payment_status AS payment_status,
    p.amount AS payment_amount,
    p.refund_status AS refund_status,
    p.refund_id AS refund_id,
    p.refund_reason AS refund_reason,
    p.refund_amount AS refund_amount,
    p.refunded_at AS refunded_at

FROM public.registrations r
LEFT JOIN public.entries e ON r.id = e.registration_id
LEFT JOIN public.payments p ON r.id = p.registration_id;

COMMIT;
