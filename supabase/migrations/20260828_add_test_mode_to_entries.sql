-- Migration: Add is_test column to entries table and ensure other coordinator fields exist
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS ticket_id TEXT DEFAULT NULL;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS coordinator_id UUID REFERENCES public.admins(id) DEFAULT NULL;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ENTERED';
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

-- Drop the old unique constraint on registration_id and replace it with (registration_id, is_test)
ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_registration_id_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'entries' 
          AND constraint_name = 'entries_registration_id_is_test_key'
    ) THEN
        ALTER TABLE public.entries ADD CONSTRAINT entries_registration_id_is_test_key UNIQUE (registration_id, is_test);
    END IF;
END $$;

-- Re-create registrations_with_details View to include is_test
CREATE OR REPLACE VIEW public.registrations_with_details AS
SELECT
    r.*,
    COALESCE(e.entry_status, 'NOT_ENTERED') AS entry_status,
    e.entry_time AS entry_time,
    e.scanned_by AS entry_scanned_by,
    e.scanner_device AS entry_scanner_device,
    e.coordinator_id AS entry_coordinator_id,
    e.scanned_at AS entry_scanned_at,
    e.is_test AS entry_is_test,
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
