/**
 * Controleert Content-Length header tegen een maximum.
 * Voorkomt dat zeer grote bodies worden gelezen (DoS-mitigatie).
 */
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB voor JSON endpoints

export function checkBodySize(req: Request, maxBytes: number = MAX_BYTES): boolean {
  const len = req.headers.get("content-length");
  if (!len) return true; // geen length = laat route zelf handelen
  const n = parseInt(len, 10);
  if (Number.isNaN(n) || n < 0) return false;
  return n <= maxBytes;
}
