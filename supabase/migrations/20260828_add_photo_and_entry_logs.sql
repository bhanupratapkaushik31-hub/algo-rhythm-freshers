-- =========================================================
-- ALGO-RHYTHM : PHOTO + ENTRY/RE-ENTRY SYSTEM
-- COMPLETE DATABASE FIX
-- =========================================================

BEGIN;

-- =========================================================
-- 1. REGISTRATIONS - PHOTO
-- =========================================================

ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS photo_path TEXT DEFAULT NULL;


-- =========================================================
-- 2. ENTRIES - MAKE SURE REQUIRED COLUMNS EXIST
-- =========================================================

ALTER TABLE public.entries
ADD COLUMN IF NOT EXISTS coordinator_id UUID DEFAULT NULL;

ALTER TABLE public.entries
ADD COLUMN IF NOT EXISTS scanned_by TEXT DEFAULT NULL;

ALTER TABLE public.entries
ADD COLUMN IF NOT EXISTS scanner_device TEXT DEFAULT NULL;

ALTER TABLE public.entries
ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.entries
ADD COLUMN IF NOT EXISTS entry_time TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.entries
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;


-- =========================================================
-- 3. FIX ENTRY STATUS
-- =========================================================

-- Remove old incompatible check constraint if it exists
ALTER TABLE public.entries
DROP CONSTRAINT IF EXISTS entries_entry_status_check;

-- Make sure entry_status exists
ALTER TABLE public.entries
ADD COLUMN IF NOT EXISTS entry_status TEXT DEFAULT 'NOT_ENTERED';

-- Normalize NULL values
UPDATE public.entries
SET entry_status = 'NOT_ENTERED'
WHERE entry_status IS NULL;

-- Allow all statuses required by the application
ALTER TABLE public.entries
ADD CONSTRAINT entries_entry_status_check
CHECK (
    entry_status IN (
        'NOT_ENTERED',
        'ENTERED',
        'RE_ENTERED',
        'ENTRY',
        'RE_ENTRY'
    )
);


-- =========================================================
-- 4. PAYMENTS - MISSING REFUND / PAYMENT COLUMNS
-- =========================================================

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT NULL;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT NULL;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS refund_id TEXT DEFAULT NULL;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS refund_reason TEXT DEFAULT NULL;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT NULL;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT DEFAULT NULL;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT DEFAULT NULL;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;


-- =========================================================
-- 5. ENTRY LOGS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.entry_logs (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    registration_id UUID
        REFERENCES public.registrations(id)
        ON DELETE CASCADE,

    action TEXT NOT NULL,

    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    scanned_by TEXT DEFAULT NULL,

    scanner_device TEXT DEFAULT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);


-- =========================================================
-- 6. ENTRY LOG STATUS
-- =========================================================

ALTER TABLE public.entry_logs
DROP CONSTRAINT IF EXISTS entry_logs_action_check;

ALTER TABLE public.entry_logs
ADD CONSTRAINT entry_logs_action_check
CHECK (
    action IN ('ENTRY', 'RE_ENTRY')
);


-- =========================================================
-- 7. ENABLE RLS
-- =========================================================

ALTER TABLE public.entry_logs
ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 8. ENTRY LOG POLICY
-- =========================================================

DROP POLICY IF EXISTS
"Admins and coordinators can do all on entry_logs"
ON public.entry_logs;

CREATE POLICY
"Admins and coordinators can do all on entry_logs"

ON public.entry_logs

FOR ALL

TO authenticated

USING (true)

WITH CHECK (true);


-- =========================================================
-- 9. STUDENT PHOTO STORAGE BUCKET
-- =========================================================

INSERT INTO storage.buckets
(id, name, public)

VALUES
('student-photos', 'student-photos', false)

ON CONFLICT (id) DO NOTHING;


-- =========================================================
-- 10. PHOTO STORAGE POLICY
-- =========================================================

DROP POLICY IF EXISTS
"Allow authenticated users to read student-photos"
ON storage.objects;

CREATE POLICY
"Allow authenticated users to read student-photos"

ON storage.objects

FOR SELECT

TO authenticated

USING (
    bucket_id = 'student-photos'
);


-- =========================================================
-- 11. PHOTO UPLOAD POLICY
-- =========================================================

DROP POLICY IF EXISTS
"Allow authenticated users to upload student-photos"
ON storage.objects;

CREATE POLICY
"Allow authenticated users to upload student-photos"

ON storage.objects

FOR INSERT

TO authenticated

WITH CHECK (
    bucket_id = 'student-photos'
);


-- =========================================================
-- 12. RECREATE REGISTRATIONS VIEW
-- =========================================================

DROP VIEW IF EXISTS public.registrations_with_details;

CREATE VIEW public.registrations_with_details
WITH (security_invoker = true)
AS

SELECT

    r.*,

    -- ENTRY INFORMATION
    COALESCE(e.entry_status, 'NOT_ENTERED')
        AS entry_status,

    e.entry_time
        AS entry_time,

    e.scanned_by
        AS entry_scanned_by,

    e.scanner_device
        AS entry_scanner_device,

    e.coordinator_id
        AS entry_coordinator_id,

    e.scanned_at
        AS entry_scanned_at,

    e.is_test
        AS entry_is_test,

    -- PAYMENT INFORMATION
    p.razorpay_payment_id
        AS razorpay_payment_id,

    p.razorpay_order_id
        AS razorpay_order_id,

    p.paid_at
        AS payment_time,

    p.payment_method
        AS payment_method,

    p.payment_status
        AS payment_status,

    p.refund_status
        AS refund_status,

    p.refund_id
        AS refund_id,

    p.refund_reason
        AS refund_reason,

    p.refund_amount
        AS refund_amount,

    p.refunded_at
        AS refunded_at

FROM public.registrations r

LEFT JOIN public.entries e
    ON r.id = e.registration_id

LEFT JOIN public.payments p
    ON r.id = p.registration_id;


-- =========================================================
-- 13. COMMENTS
-- =========================================================

COMMENT ON COLUMN public.registrations.photo_path
IS 'Storage path of registered student photo';

COMMENT ON TABLE public.entry_logs
IS 'Stores ENTRY and RE_ENTRY history for event security';


COMMIT;


-- =========================================================
-- DONE
-- =========================================================