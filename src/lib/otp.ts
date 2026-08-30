import crypto from 'crypto';
import { supabaseAdmin } from './supabaseAdmin';

const OTP_SECRET = process.env.SESSION_SECRET || 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.RAZORPAY_KEY_SECRET || 
  'algorhythm-ticket-auth-secret-key-2026';

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_VERIFY_ATTEMPTS = 5;
const SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

// Memory fallback store if ticket_otps table is awaiting manual migration
interface MemoryOtpRecord {
  id: string;
  contact: string;
  contact_type: string;
  otp_hash: string;
  attempts: number;
  max_attempts: number;
  expires_at: number;
  verified_at?: number;
  consumed_at?: number;
  created_at: number;
}
const memoryOtpStore = new Map<string, MemoryOtpRecord>();

export function normalizeContact(input: string): { contact: string; type: 'phone' | 'email' } {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return {
      contact: trimmed.toLowerCase(),
      type: 'email'
    };
  }

  // Normalize Indian mobile number
  let digits = trimmed.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.substring(2);
  }
  return {
    contact: digits,
    type: 'phone'
  };
}

function hashOtp(contact: string, otp: string): string {
  return crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`${contact}:${otp}`)
    .digest('hex');
}

/**
 * Generates a 6-digit cryptographically secure OTP, enforces cooldown, and stores its hash.
 */
export async function generateAndStoreOtp(
  contact: string,
  contactType: 'phone' | 'email'
): Promise<{ success: boolean; otp?: string; cooldownSeconds?: number; error?: string }> {
  const now = Date.now();
  const expiresAt = new Date(now + OTP_EXPIRY_MS).toISOString();

  // 1. Check for recent active OTP to enforce 60s cooldown
  let isDbAvailable = true;
  try {
    const { data: recentOtps, error: fetchErr } = await supabaseAdmin
      .from('ticket_otps')
      .select('created_at')
      .eq('contact', contact)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchErr) {
      isDbAvailable = false;
    } else if (recentOtps && recentOtps.length > 0) {
      const lastCreatedTime = new Date(recentOtps[0].created_at).getTime();
      const elapsed = now - lastCreatedTime;
      if (elapsed < RESEND_COOLDOWN_MS) {
        const remaining = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return {
          success: false,
          error: 'COOLDOWN_ACTIVE',
          cooldownSeconds: remaining
        };
      }
    }
  } catch {
    isDbAvailable = false;
  }

  // Memory fallback cooldown check if DB had an issue
  if (!isDbAvailable) {
    const memRecord = memoryOtpStore.get(contact);
    if (memRecord && (now - memRecord.created_at) < RESEND_COOLDOWN_MS) {
      const remaining = Math.ceil((RESEND_COOLDOWN_MS - (now - memRecord.created_at)) / 1000);
      return {
        success: false,
        error: 'COOLDOWN_ACTIVE',
        cooldownSeconds: remaining
      };
    }
  }

  // 2. Generate cryptographically secure 6-digit random code
  const rawOtp = String(crypto.randomInt(100000, 1000000));
  const otpHash = hashOtp(contact, rawOtp);

  // 3. Persist hashed OTP
  if (isDbAvailable) {
    try {
      const { error: insertErr } = await supabaseAdmin
        .from('ticket_otps')
        .insert({
          contact,
          contact_type: contactType,
          otp_hash: otpHash,
          attempts: 0,
          max_attempts: MAX_VERIFY_ATTEMPTS,
          expires_at: expiresAt,
          created_at: new Date(now).toISOString()
        });

      if (insertErr) {
        console.warn('[OTP Storage] DB insert failed, using memory store fallback:', insertErr.message);
        isDbAvailable = false;
      }
    } catch {
      isDbAvailable = false;
    }
  }

  if (!isDbAvailable) {
    memoryOtpStore.set(contact, {
      id: crypto.randomUUID(),
      contact,
      contact_type: contactType,
      otp_hash: otpHash,
      attempts: 0,
      max_attempts: MAX_VERIFY_ATTEMPTS,
      expires_at: now + OTP_EXPIRY_MS,
      created_at: now
    });
  }

  return {
    success: true,
    otp: rawOtp
  };
}

/**
 * Verifies an entered OTP server-side with brute-force defense and timing-safe comparison.
 */
export async function verifyOtp(
  contact: string,
  enteredOtp: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const cleanOtp = enteredOtp.trim();
  if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    return {
      success: false,
      error: 'INVALID_FORMAT',
      message: 'Please enter a valid 6-digit code.'
    };
  }

  const now = Date.now();
  let dbRecord: any = null;
  let isDbAvailable = true;

  try {
    const { data, error } = await supabaseAdmin
      .from('ticket_otps')
      .select('*')
      .eq('contact', contact)
      .is('consumed_at', null)
      .gt('expires_at', new Date(now).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      if (error) isDbAvailable = false;
    } else {
      dbRecord = data[0];
    }
  } catch {
    isDbAvailable = false;
  }

  // Memory fallback if DB query failed
  if (!isDbAvailable || !dbRecord) {
    const memRecord = memoryOtpStore.get(contact);
    if (memRecord && !memRecord.consumed_at && memRecord.expires_at > now) {
      dbRecord = memRecord;
    }
  }

  if (!dbRecord) {
    return {
      success: false,
      error: 'EXPIRED_OR_NOT_FOUND',
      message: 'Verification code has expired or was not found. Please request a new code.'
    };
  }

  // Check attempt limit
  if (dbRecord.attempts >= dbRecord.max_attempts) {
    return {
      success: false,
      error: 'TOO_MANY_ATTEMPTS',
      message: 'Too many failed attempts. For security, please request a new verification code.'
    };
  }

  // Verify hash using timing-safe comparison
  const calculatedHash = hashOtp(contact, cleanOtp);
  let isMatch = false;
  try {
    isMatch = crypto.timingSafeEqual(
      Buffer.from(calculatedHash),
      Buffer.from(dbRecord.otp_hash)
    );
  } catch {
    isMatch = false;
  }

  if (!isMatch) {
    const nextAttempts = dbRecord.attempts + 1;

    // Update attempts in DB or memory
    if (dbRecord.id && isDbAvailable) {
      await supabaseAdmin
        .from('ticket_otps')
        .update({
          attempts: nextAttempts,
          consumed_at: nextAttempts >= dbRecord.max_attempts ? new Date(now).toISOString() : null
        })
        .eq('id', dbRecord.id);
    } else {
      dbRecord.attempts = nextAttempts;
      if (nextAttempts >= dbRecord.max_attempts) {
        dbRecord.consumed_at = now;
      }
    }

    if (nextAttempts >= dbRecord.max_attempts) {
      return {
        success: false,
        error: 'MAX_ATTEMPTS_EXCEEDED',
        message: 'Too many incorrect attempts. Please request a new verification code.'
      };
    }

    const remaining = dbRecord.max_attempts - nextAttempts;
    return {
      success: false,
      error: 'INCORRECT_CODE',
      message: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
    };
  }

  // Mark as verified and consumed
  const timestamp = new Date(now).toISOString();
  if (dbRecord.id && isDbAvailable) {
    await supabaseAdmin
      .from('ticket_otps')
      .update({
        verified_at: timestamp,
        consumed_at: timestamp
      })
      .eq('id', dbRecord.id);
  } else {
    dbRecord.verified_at = now;
    dbRecord.consumed_at = now;
  }

  return { success: true };
}

/**
 * Creates a tamper-proof, signed ticket session token.
 * Contains authorized registration IDs and expiration timestamp.
 */
export function createTicketSession(contact: string, registrationIds: string[]): string {
  const payload = {
    sid: crypto.randomUUID(),
    contact,
    regIds: registrationIds,
    exp: Date.now() + SESSION_EXPIRY_MS
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', OTP_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a ticket session token and returns the authorized registration IDs.
 */
export function verifyTicketSession(token: string | undefined): {
  valid: boolean;
  contact?: string;
  regIds?: string[];
} {
  if (!token || typeof token !== 'string') {
    return { valid: false };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [payloadB64, signature] = parts;

  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', OTP_SECRET)
    .update(payloadB64)
    .digest('base64url');

  try {
    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    if (!isSignatureValid) {
      return { valid: false };
    }
  } catch {
    return { valid: false };
  }

  // Parse payload and check expiration
  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);

    if (!payload.exp || Date.now() > payload.exp) {
      return { valid: false }; // Expired
    }

    if (!Array.isArray(payload.regIds) || payload.regIds.length === 0) {
      return { valid: false };
    }

    return {
      valid: true,
      contact: payload.contact,
      regIds: payload.regIds
    };
  } catch {
    return { valid: false };
  }
}
