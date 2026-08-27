-- Migration: Add email_status and email_error columns to registrations table
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS email_error TEXT DEFAULT NULL;
