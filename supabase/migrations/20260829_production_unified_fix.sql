-- =========================================================================
-- ALGO-RHYTHM 2K26: UNIFIED PRODUCTION DATABASE HARDENING MIGRATION
-- Migration Date: 2026-08-29
-- Safe, Idempotent, Non-destructive to existing production student data
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. WEBHOOK IDEMPOTENCY TRACKING
-- Prevents duplicate execution of Razorpay webhook retries
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to webhook_events" ON public.webhook_events;
CREATE POLICY "Allow service role full access to webhook_events" 
ON public.webhook_events 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- -------------------------------------------------------------------------
-- 2. PRIVATE STORAGE BUCKET FOR STUDENT PHOTOS
-- -------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage read policy for authenticated coordinators/admins
DROP POLICY IF EXISTS "Allow authenticated users to read student-photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to read student-photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'student-photos');

-- Storage upload policy for authenticated registration flow
DROP POLICY IF EXISTS "Allow authenticated users to upload student-photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload student-photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-photos');

-- -------------------------------------------------------------------------
-- 3. HIGH-CONCURRENCY PERFORMANCE & RETRIEVAL INDEXES
-- Optimized for instant ticket lookup by phone, token, ticket_id, or order
-- -------------------------------------------------------------------------
-- Registrations table
CREATE INDEX IF NOT EXISTS idx_registrations_ticket_token 
    ON public.registrations(ticket_token);

CREATE INDEX IF NOT EXISTS idx_registrations_ticket_id 
    ON public.registrations(ticket_id);

CREATE INDEX IF NOT EXISTS idx_registrations_phone 
    ON public.registrations(phone);

CREATE INDEX IF NOT EXISTS idx_registrations_email 
    ON public.registrations(email);

CREATE INDEX IF NOT EXISTS idx_registrations_reg_no 
    ON public.registrations(registration_number);

CREATE INDEX IF NOT EXISTS idx_registrations_status 
    ON public.registrations(registration_status);

-- Payments table
CREATE INDEX IF NOT EXISTS idx_payments_registration_id 
    ON public.payments(registration_id);

CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id 
    ON public.payments(razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id 
    ON public.payments(razorpay_payment_id);

CREATE INDEX IF NOT EXISTS idx_payments_status 
    ON public.payments(payment_status);

-- Entries table
CREATE INDEX IF NOT EXISTS idx_entries_registration_id 
    ON public.entries(registration_id);

CREATE INDEX IF NOT EXISTS idx_entries_ticket_id 
    ON public.entries(ticket_id);

CREATE INDEX IF NOT EXISTS idx_entries_status 
    ON public.entries(entry_status);

-- Entry logs table
CREATE INDEX IF NOT EXISTS idx_entry_logs_registration_id 
    ON public.entry_logs(registration_id);

CREATE INDEX IF NOT EXISTS idx_entry_logs_created_at 
    ON public.entry_logs(created_at DESC);

-- -------------------------------------------------------------------------
-- 4. REGISTRATIONS_WITH_DETAILS VIEW
-- Matches exactly with active production columns without obsolete references
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
