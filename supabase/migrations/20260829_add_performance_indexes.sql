-- =========================================================================
-- ALGO-RHYTHM 2K26: PRODUCTION PERFORMANCE & CONCURRENCY INDEXES
-- Purpose: Optimize lookup latency and ensure index-backed concurrency locks
-- =========================================================================

-- 1. REGISTRATIONS TABLE
CREATE INDEX IF NOT EXISTS idx_registrations_ticket_token 
  ON public.registrations(ticket_token);

CREATE INDEX IF NOT EXISTS idx_registrations_ticket_id 
  ON public.registrations(ticket_id);

CREATE INDEX IF NOT EXISTS idx_registrations_phone 
  ON public.registrations(phone);

CREATE INDEX IF NOT EXISTS idx_registrations_email 
  ON public.registrations(email);

CREATE INDEX IF NOT EXISTS idx_registrations_registration_number 
  ON public.registrations(registration_number);

CREATE INDEX IF NOT EXISTS idx_registrations_status 
  ON public.registrations(registration_status);

-- 2. PAYMENTS TABLE
CREATE INDEX IF NOT EXISTS idx_payments_registration_id 
  ON public.payments(registration_id);

CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id 
  ON public.payments(razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id 
  ON public.payments(razorpay_payment_id);

CREATE INDEX IF NOT EXISTS idx_payments_status 
  ON public.payments(payment_status);

-- 3. ENTRIES TABLE
CREATE INDEX IF NOT EXISTS idx_entries_registration_id 
  ON public.entries(registration_id);

CREATE INDEX IF NOT EXISTS idx_entries_ticket_id 
  ON public.entries(ticket_id);

CREATE INDEX IF NOT EXISTS idx_entries_status 
  ON public.entries(entry_status);

-- 4. ENTRY LOGS TABLE
CREATE INDEX IF NOT EXISTS idx_entry_logs_registration_id 
  ON public.entry_logs(registration_id);

CREATE INDEX IF NOT EXISTS idx_entry_logs_created_at 
  ON public.entry_logs(created_at DESC);
