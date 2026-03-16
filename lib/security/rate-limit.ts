/**
 * Eenvoudige in-memory rate limiter per IP.
 * Voor productie: gebruik Redis of een externe limiter.
 */

const windowMs = 60 * 1000; // 1 minuut
const maxRequests = 60; // max requests per IP per minuut

const store = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export function checkRateLimit(req: Request): { ok: boolean; remaining?: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  let entry = store.get(ip);

  if (!entry) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: maxRequests - 1 };
  }

  if (now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(ip, entry);
    return { ok: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { ok: false };
  }
  return { ok: true, remaining: Math.max(0, maxRequests - entry.count) };
}
