-- Migration: Add email_sent_at column to registrations table
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
