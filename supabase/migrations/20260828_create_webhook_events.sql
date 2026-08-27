-- Migration: Create webhook_events table for idempotency tracking
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
