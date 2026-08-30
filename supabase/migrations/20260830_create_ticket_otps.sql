-- =========================================================================
-- ALGO-RHYTHM 2K26: PRODUCTION OTP SECURITY MIGRATION
-- Migration Date: 2026-08-30
-- Safe, Idempotent, Non-destructive to existing production student data
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. TICKET ACCESS OTPs TABLE
-- Stores cryptographically hashed OTPs for ticket retrieval verification.
-- Raw OTPs are NEVER stored in plaintext.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact TEXT NOT NULL,
    contact_type TEXT NOT NULL DEFAULT 'email',
    otp_hash TEXT NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL,
    max_attempts INTEGER DEFAULT 5 NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -------------------------------------------------------------------------
-- 2. PERFORMANCE & RATE-LIMITING INDEXES
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ticket_otps_contact_active 
    ON public.ticket_otps(contact, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_otps_expires_at 
    ON public.ticket_otps(expires_at);

-- -------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS)
-- Crucial: Block public/anonymous access completely.
-- Only the backend server (service_role) can access OTP records.
-- -------------------------------------------------------------------------
ALTER TABLE public.ticket_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to ticket_otps" ON public.ticket_otps;
CREATE POLICY "Allow service role full access to ticket_otps" 
ON public.ticket_otps 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

COMMIT;
