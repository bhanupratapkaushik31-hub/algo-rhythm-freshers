-- =========================================================================
-- ALGO-RHYTHM 2K26: ADD MODELING TALENT / PERFORMANCE COLUMN
-- Migration Date: 2026-09-01
-- Safe, Idempotent, Non-destructive to existing production student data
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. ADD modeling_talent COLUMN TO registrations TABLE
-- Stores the participant's talent/performance description.
-- NULL when modeling = 'No', populated string when modeling = 'Yes'.
-- -------------------------------------------------------------------------
ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS modeling_talent TEXT DEFAULT NULL;

-- -------------------------------------------------------------------------
-- 2. UPDATE registrations_with_details VIEW
-- Include the new modeling_talent column so all admin queries pick it up.
-- Matches the existing view definition from 20260829_production_unified_fix.sql
-- but adds r.modeling_talent to the SELECT list.
-- -------------------------------------------------------------------------
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
    r.modeling_talent,

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
    p.refund_status AS refund_status,
    p.refund_id AS refund_id,
    p.refund_reason AS refund_reason,
    p.refund_amount AS refund_amount,
    p.refunded_at AS refunded_at

FROM public.registrations r
LEFT JOIN public.entries e ON r.id = e.registration_id
LEFT JOIN public.payments p ON r.id = p.registration_id;

COMMIT;
