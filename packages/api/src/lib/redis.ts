/**
 * Redis helper module — Upstash Redis via REST API.
 *
 * Three capabilities:
 *   withCache        — cache-aside for expensive/external calls
 *   checkRateLimit   — fixed-window rate limiting (INCR + EXPIRE)
 *   acquireJobLock   — single-flight dedup via SET NX EX
 *
 * All functions degrade gracefully when env vars are not set:
 *   withCache       → calls fn() directly (no caching)
 *   checkRateLimit  → allows the request (fail-open in dev)
 *   acquireJobLock  → grants the lock (fail-open in dev)
 *
 * Required env vars:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from "@upstash/redis";

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client: Redis | null = null;
let _warned = false;

function getClient(): Redis | null {
  if (_client) return _client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (!_warned) {
      console.warn(
        "[redis] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — " +
          "caching and rate-limiting are disabled.",
      );
      _warned = true;
    }
    return null;
  }

  _client = new Redis({ url, token });
  return _client;
}

// ─── Cache-aside ──────────────────────────────────────────────────────────────

/**
 * Read a value from Redis; on miss, compute it with `fn`, store it, and return.
 *
 * @param key        Redis key
 * @param ttlSeconds How long to cache (seconds)
 * @param fn         Async function that produces the value on cache miss
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  const redis = getClient();
  if (!redis) return fn();

  const cached = await redis.get<T>(key);
  if (cached !== null) return cached;

  const value = await fn();
  // Fire-and-forget the write — a failed SET shouldn't break the response
  void redis.set(key, value, { ex: ttlSeconds }).catch((err: unknown) =>
    console.error("[redis] cache write failed:", err),
  );
  return value;
}

/**
 * Explicitly bust a cached value (e.g. after a mutation).
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  await redis.del(key);
}

// ─── Fixed-window rate limiting ───────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  /** How many requests have been made in the current window */
  count: number;
  /** How many requests remain before hitting the limit */
  remaining: number;
  /** Seconds until the current window resets */
  resetInSeconds: number;
}

/**
 * Fixed-window rate limiter.
 *
 * Increments a counter for `key`; sets TTL on first call in a window.
 * The key should encode the identifier and window boundary — e.g.:
 *   `rl:ai_report:user_123`      (per user, window set on first call)
 *
 * @param key           Unique rate-limit key
 * @param limit         Max requests per window
 * @param windowSeconds Window duration in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getClient();
  if (!redis) {
    return { allowed: true, count: 0, remaining: limit, resetInSeconds: windowSeconds };
  }

  // INCR returns 1 on key creation, so the first INCR also creates the key
  const count = await redis.incr(key);

  if (count === 1) {
    // First hit in a fresh window — attach TTL (fire-and-forget is fine here;
    // if EXPIRE fails the key will just never expire until next restart)
    await redis.expire(key, windowSeconds);
  }

  const ttl = await redis.ttl(key);
  const resetInSeconds = ttl > 0 ? ttl : windowSeconds;

  return {
    allowed: count <= limit,
    count,
    remaining: Math.max(0, limit - count),
    resetInSeconds,
  };
}

// ─── Job-lock / single-flight dedup ──────────────────────────────────────────

/**
 * Acquire an exclusive lock via SET NX EX.
 *
 * Returns `true` if the lock was acquired (safe to proceed),
 * `false` if another caller already holds it.
 *
 * Always pair with `releaseJobLock` in a `finally` block to release early.
 * The `ttlSeconds` acts as a dead-man timer in case of crash.
 *
 * @param key        Unique lock key (encodes job type + identity)
 * @param ttlSeconds Maximum time the lock can be held (safety timeout)
 */
export async function acquireJobLock(key: string, ttlSeconds: number): Promise<boolean> {
  const redis = getClient();
  if (!redis) return true;
  const result = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
  return result === "OK";
}

/**
 * Release a job lock before its TTL expires.
 * Idempotent — safe to call even if the lock was never acquired.
 */
export async function releaseJobLock(key: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  await redis.del(key);
}
