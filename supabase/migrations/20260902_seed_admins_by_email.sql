-- =========================================================================
-- ALGO-RHYTHM 2K26: DATABASE-DRIVEN ADMIN & COORDINATOR MANAGEMENT
-- Migration Date: 2026-09-02
-- Safe, Idempotent, Non-destructive
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. Ensure public.admins table has proper structure and indexes
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'scanner', 'coordinator')),
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_role ON public.admins(role);

-- -------------------------------------------------------------------------
-- 2. Enable Row Level Security (RLS) & Policies
-- -------------------------------------------------------------------------
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to admins" ON public.admins;
CREATE POLICY "Allow service role full access to admins"
ON public.admins
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to read admins" ON public.admins;
CREATE POLICY "Allow authenticated users to read admins"
ON public.admins
FOR SELECT
TO authenticated
USING (true);

-- -------------------------------------------------------------------------
-- 3. SEED INITIAL SUPER ADMIN ACCOUNTS
-- You can add or change super admin / coordinator emails directly here:
-- -------------------------------------------------------------------------
INSERT INTO public.admins (email, name, role, active)
VALUES 
    ('scailpu@gmail.com', 'Super Administrator', 'super_admin', true),
    ('bhanupratapias2005@gmail.com', 'Super Administrator', 'super_admin', true)
ON CONFLICT (email) 
DO UPDATE SET 
    role = EXCLUDED.role,
    active = EXCLUDED.active,
    updated_at = timezone('utc'::text, now());

COMMIT;
