/**
 * In-memory rate limiter for brute force protection
 * In production, this should be replaced with Redis for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil: number | null;
}

// Store for rate limiting (in-memory)
// In production, use Redis for distributed rate limiting across instances
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const MAX_ATTEMPTS = 5; // Maximum login attempts before blocking
const WINDOW_MS = 15 * 60 * 1000; // 15 minute window
const BLOCK_DURATION_MS = 30 * 60 * 1000; // Block for 30 minutes after max attempts
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean up old entries every 5 minutes

// Cleanup old entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      // Remove entries that are no longer blocked and outside the window
      if (
        (!entry.blockedUntil || entry.blockedUntil < now) &&
        now - entry.firstAttempt > WINDOW_MS
      ) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  blockedUntil: Date | null;
  message: string;
}

/**
 * Check if a login attempt is allowed for the given identifier (email or IP)
 */
export function checkRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const key = `login:${identifier.toLowerCase()}`;

  let entry = rateLimitStore.get(key);

  // If blocked, check if block has expired
  if (entry?.blockedUntil) {
    if (now < entry.blockedUntil) {
      const remainingMs = entry.blockedUntil - now;
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return {
        allowed: false,
        remainingAttempts: 0,
        blockedUntil: new Date(entry.blockedUntil),
        message: `Too many login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
      };
    } else {
      // Block expired, reset the entry
      rateLimitStore.delete(key);
      entry = undefined;
    }
  }

  // If no entry or outside window, allow
  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
      blockedUntil: null,
      message: '',
    };
  }

  // Check if within limits
  const remainingAttempts = MAX_ATTEMPTS - entry.count;

  if (remainingAttempts <= 0) {
    // Block the user
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    rateLimitStore.set(key, entry);

    const remainingMinutes = Math.ceil(BLOCK_DURATION_MS / 60000);
    return {
      allowed: false,
      remainingAttempts: 0,
      blockedUntil: new Date(entry.blockedUntil),
      message: `Too many login attempts. Please try again in ${remainingMinutes} minutes.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts,
    blockedUntil: null,
    message: '',
  };
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(identifier: string): RateLimitResult {
  const now = Date.now();
  const key = `login:${identifier.toLowerCase()}`;

  let entry = rateLimitStore.get(key);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    // Start new window
    entry = {
      count: 1,
      firstAttempt: now,
      blockedUntil: null,
    };
  } else {
    // Increment count
    entry.count++;
  }

  rateLimitStore.set(key, entry);

  const remainingAttempts = Math.max(0, MAX_ATTEMPTS - entry.count);

  // Check if should be blocked
  if (remainingAttempts === 0) {
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    rateLimitStore.set(key, entry);

    const remainingMinutes = Math.ceil(BLOCK_DURATION_MS / 60000);
    return {
      allowed: false,
      remainingAttempts: 0,
      blockedUntil: new Date(entry.blockedUntil),
      message: `Too many login attempts. Account temporarily locked for ${remainingMinutes} minutes.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts,
    blockedUntil: null,
    message: remainingAttempts <= 2
      ? `Warning: ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining before account is temporarily locked.`
      : '',
  };
}

/**
 * Clear rate limit for a successful login
 */
export function clearRateLimit(identifier: string): void {
  const key = `login:${identifier.toLowerCase()}`;
  rateLimitStore.delete(key);
}

/**
 * Get rate limit status without recording an attempt
 */
export function getRateLimitStatus(identifier: string): RateLimitResult {
  return checkRateLimit(identifier);
}
