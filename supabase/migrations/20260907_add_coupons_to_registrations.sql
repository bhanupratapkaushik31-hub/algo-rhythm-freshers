-- Migration: Add coupon_code and discount_amount to registrations table
-- Enables tracking of coupons (e.g. ALGO50 for 2nd Year) and discounted amounts

ALTER TABLE IF EXISTS registrations 
ADD COLUMN IF NOT EXISTS coupon_code TEXT;

ALTER TABLE IF EXISTS registrations 
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- Refresh registrations_with_details view if it exists
CREATE OR REPLACE VIEW registrations_with_details AS
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
FROM registrations r
LEFT JOIN LATERAL (
  SELECT * FROM payments 
  WHERE registration_id = r.id 
  ORDER BY created_at DESC 
  LIMIT 1
) p ON true
LEFT JOIN LATERAL (
  SELECT * FROM entries 
  WHERE registration_id = r.id 
  ORDER BY created_at DESC 
  LIMIT 1
) e ON true;
