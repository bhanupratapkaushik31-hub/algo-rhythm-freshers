// In-memory sliding-window rate limiter for API routes
// Suitable for Next.js deployments to prevent abuse, spam, and brute-force enumeration

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 300000); // 5 min
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 300000);
}

export interface RateLimitOptions {
  limit: number;      // Maximum allowed requests in the window
  windowMs: number;   // Window duration in milliseconds
}

export function checkRateLimit(
  identifier: string,
  prefix: string,
  options: RateLimitOptions = { limit: 20, windowMs: 60000 }
): { allowed: boolean; remaining: number; resetMs: number } {
  const key = `${prefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - options.windowMs;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter timestamps within the current sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= options.limit) {
    const oldestTimestamp = record.timestamps[0];
    const resetMs = oldestTimestamp + options.windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(resetMs, 0)
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: options.limit - record.timestamps.length,
    resetMs: options.windowMs
  };
}

export function getClientIp(request: Request): string {
  const headers = request.headers;
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  return '127.0.0.1';
}
