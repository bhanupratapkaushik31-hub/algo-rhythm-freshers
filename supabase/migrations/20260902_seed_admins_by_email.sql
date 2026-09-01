-- =========================================================================
-- ALGO-RHYTHM 2K26: DATABASE-DRIVEN ADMIN & COORDINATOR MANAGEMENT
-- Migration Date: 2026-09-02
-- Safe, Idempotent, Non-destructive
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. Create admins table if not exists or ensure proper columns & defaults
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'scanner',
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all columns exist on existing pre-created admins tables
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Administrator';
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'scanner';
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Ensure default UUID generation is enabled on id column
ALTER TABLE public.admins ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Ensure unique constraint on email for ON CONFLICT support
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'admins_email_unique' AND conrelid = 'public.admins'::regclass
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'admins_email_key' AND conrelid = 'public.admins'::regclass
    ) THEN
        ALTER TABLE public.admins ADD CONSTRAINT admins_email_unique UNIQUE (email);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

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
-- Links with auth.users ID if account already exists, otherwise generates UUID
-- -------------------------------------------------------------------------
INSERT INTO public.admins (id, email, name, role, active)
VALUES 
    (
        COALESCE((SELECT id FROM auth.users WHERE email = 'scailpu@gmail.com' LIMIT 1), gen_random_uuid()), 
        'scailpu@gmail.com', 
        'Super Administrator', 
        'super_admin', 
        true
    ),
    (
        COALESCE((SELECT id FROM auth.users WHERE email = 'bhanupratapias2005@gmail.com' LIMIT 1), gen_random_uuid()), 
        'bhanupratapias2005@gmail.com', 
        'Super Administrator', 
        'super_admin', 
        true
    )
ON CONFLICT (email) 
DO UPDATE SET 
    role = EXCLUDED.role,
    active = EXCLUDED.active,
    updated_at = timezone('utc'::text, now());

-- Automatically sync matching auth.users id if available
UPDATE public.admins a
SET id = u.id,
    updated_at = timezone('utc'::text, now())
FROM auth.users u
WHERE a.email = u.email AND a.id != u.id;

COMMIT;
