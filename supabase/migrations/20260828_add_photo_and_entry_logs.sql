-- Migration: Add photo_path column to registrations and create entry_logs table

-- 1. Add photo_path column to registrations
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS photo_path TEXT DEFAULT NULL;

-- 2. Create entry_logs table
CREATE TABLE IF NOT EXISTS public.entry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'ENTRY' or 'RE_ENTRY'
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scanned_by TEXT,
    scanner_device TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS for entry_logs if not already enabled
ALTER TABLE public.entry_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for entry_logs (Drop first if exists to prevent duplicates)
DROP POLICY IF EXISTS "Admins and coordinators can do all on entry_logs" ON public.entry_logs;
CREATE POLICY "Admins and coordinators can do all on entry_logs" 
ON public.entry_logs 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 5. Ensure student-photos private storage bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('student-photos', 'student-photos', false) 
ON CONFLICT (id) DO NOTHING;

-- 6. Storage policies for student-photos
DROP POLICY IF EXISTS "Allow authenticated users to read student-photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to read student-photos"
ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'student-photos');

-- 7. Re-create registrations_with_details View to include new columns
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
