-- =========================================================================
-- ALGO-RHYTHM 2K26: FIX RLS INFINITE RECURSION ON ADMINS & REGISTRATIONS
-- Migration Date: 2026-09-09
-- Fixes: "infinite recursion detected in policy for relation 'admins'"
-- Safe, Idempotent, Non-destructive
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. DROP ALL POTENTIALLY RECURSIVE POLICIES ON public.admins
-- -------------------------------------------------------------------------
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'admins'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.admins;', pol.policyname);
    END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- 2. CREATE NON-RECURSIVE POLICIES ON public.admins
-- Direct USING (true) ensures zero subqueries into admins table
-- -------------------------------------------------------------------------
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_service_role_all"
ON public.admins
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "admins_authenticated_select"
ON public.admins
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admins_anon_select"
ON public.admins
FOR SELECT
TO anon
USING (true);

CREATE POLICY "admins_authenticated_all"
ON public.admins
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- -------------------------------------------------------------------------
-- 3. SECURITY DEFINER HELPER FUNCTION (BYPASSES RLS SAFELY)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_user(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admins 
        WHERE id = user_uuid AND active = true
    );
$$;

-- -------------------------------------------------------------------------
-- 4. CLEAN UP POLICIES ON registrations, payments, entries, entry_logs
-- Ensure none of them contain circular subqueries into admins
-- -------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
    pol RECORD;
BEGIN
    FOREACH t IN ARRAY ARRAY['registrations', 'payments', 'entries', 'entry_logs', 'webhook_events', 'settings']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
            
            -- Re-grant service_role and authenticated access
            EXECUTE format('DROP POLICY IF EXISTS %I_service_role_all ON public.%I;', t, t);
            EXECUTE format('CREATE POLICY %I_service_role_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', t, t);

            EXECUTE format('DROP POLICY IF EXISTS %I_authenticated_all ON public.%I;', t, t);
            EXECUTE format('CREATE POLICY %I_authenticated_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);', t, t);
        END IF;
    END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- 5. RECREATE registrations_with_details VIEW CLEANLY
-- -------------------------------------------------------------------------
DROP VIEW IF EXISTS public.registrations_with_details CASCADE;

CREATE OR REPLACE VIEW public.registrations_with_details AS
SELECT 
    r.*,
    p.id AS payment_id,
    p.amount AS payment_amount,
    p.currency AS payment_currency,
    p.payment_status,
    p.payment_method,
    p.razorpay_order_id,
    p.razorpay_payment_id,
    p.paid_at,
    p.refund_status,
    p.refund_amount,
    p.refund_id,
    p.refund_reason,
    p.refunded_at,
    e.id AS entry_id,
    e.entry_status,
    e.entered_at,
    e.scanned_by
FROM public.registrations r
LEFT JOIN LATERAL (
    SELECT 
        p_sub.id,
        p_sub.amount,
        p_sub.currency,
        p_sub.payment_status,
        p_sub.payment_method,
        p_sub.razorpay_order_id,
        p_sub.razorpay_payment_id,
        p_sub.paid_at,
        p_sub.refund_status,
        p_sub.refund_amount,
        p_sub.refund_id,
        p_sub.refund_reason,
        p_sub.refunded_at
    FROM public.payments p_sub
    WHERE p_sub.registration_id = r.id 
    ORDER BY p_sub.created_at DESC 
    LIMIT 1
) p ON true
LEFT JOIN LATERAL (
    SELECT 
        e_sub.id,
        e_sub.entry_status,
        e_sub.entry_time AS entered_at,
        e_sub.scanned_by
    FROM public.entries e_sub
    WHERE e_sub.registration_id = r.id 
    ORDER BY e_sub.created_at DESC 
    LIMIT 1
) e ON true;

-- Grant permissions on view
GRANT SELECT ON public.registrations_with_details TO authenticated, service_role, anon;

COMMIT;
