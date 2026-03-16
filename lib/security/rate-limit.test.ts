import { describe, it, expect } from "vitest";
import { checkRateLimit } from "./rate-limit";

function mockRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api", {
    headers: new Headers(headers),
  });
}

describe("checkRateLimit", () => {
  it("accepteert eerste request", () => {
    const req = mockRequest();
    const r = checkRateLimit(req);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBeLessThanOrEqual(59);
  });

  it("gebruikt x-forwarded-for als client IP", () => {
    const req = mockRequest({ "x-forwarded-for": "192.168.1.1" });
    const r = checkRateLimit(req);
    expect(r.ok).toBe(true);
  });

  it("gebruikt x-real-ip als fallback", () => {
    const req = mockRequest({ "x-real-ip": "10.0.0.1" });
    const r = checkRateLimit(req);
    expect(r.ok).toBe(true);
  });
});
