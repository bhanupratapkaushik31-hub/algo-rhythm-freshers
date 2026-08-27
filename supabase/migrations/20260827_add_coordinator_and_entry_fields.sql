-- Migration: Add coordinator and entry fields

-- 1. Add active column to admins table if not exists
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 2. Add ticket_id, coordinator_id, scanned_at, status to entries table if not exists
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS ticket_id TEXT DEFAULT NULL;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS coordinator_id UUID REFERENCES public.admins(id) DEFAULT NULL;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ENTERED';

-- 3. Add UNIQUE constraint to entries table on registration_id if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'entries' 
          AND constraint_name = 'entries_registration_id_key'
    ) THEN
        ALTER TABLE public.entries ADD CONSTRAINT entries_registration_id_key UNIQUE (registration_id);
    END IF;
END $$;

-- 4. Re-create registrations_with_details View to include new columns
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
    p.paid_at AS payment_time,
    p.payment_method AS payment_method
FROM public.registrations r
LEFT JOIN public.entries e ON r.id = e.registration_id
LEFT JOIN public.payments p ON r.id = p.registration_id AND p.payment_status = 'SUCCESS';
