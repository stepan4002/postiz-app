/**
 * SSRF (Server-Side Request Forgery) Protection Utility
 *
 * Phase 8 Plan 02 — NF1.4 security requirement.
 *
 * Validates that a user-supplied URL:
 * 1. Is a valid URL (parseable)
 * 2. Uses HTTPS protocol only
 * 3. Does not target private/reserved IP ranges (RFC 1918, loopback, link-local, APIPA)
 * 4. Does not target internal hostnames (localhost, .internal, .local, cloud metadata endpoints)
 *
 * Usage:
 *   import { assertSafeUrl } from '@social/security';
 *   assertSafeUrl(userSuppliedUrl); // throws if unsafe, returns void if safe
 */

/** Private IPv4 ranges (RFC 1918 + loopback + link-local + APIPA) */
const PRIVATE_IPV4_PATTERNS = [
  // 10.0.0.0/8 — RFC 1918 private range
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  // 172.16.0.0/12 — RFC 1918 private range (172.16.x.x – 172.31.x.x)
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  // 192.168.0.0/16 — RFC 1918 private range
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  // 127.0.0.0/8 — Loopback
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  // 169.254.0.0/16 — Link-local / APIPA (also AWS/GCP metadata endpoint)
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
];

/** Private IPv6 ranges (loopback + ULA) */
const PRIVATE_IPV6_PATTERNS = [
  // ::1 — loopback
  /^::1$/,
  // fc00::/7 — Unique Local Address (ULA), covers fc00:: and fd00::
  /^f[cd][0-9a-f]{2}:/i,
];

/** Internal hostnames and TLD suffixes that should never be contacted */
const BLOCKED_HOSTNAMES = ['localhost'];
const BLOCKED_TLD_SUFFIXES = ['.internal', '.local'];

/**
 * Asserts that the given URL is safe to make outbound requests to.
 *
 * @param rawUrl - The URL string provided by the user
 * @throws {Error} "Invalid URL" if the string is not a parseable URL
 * @throws {Error} "Only HTTPS URLs allowed" if the protocol is not https:
 * @throws {Error} "Private IP ranges are not allowed" if targeting private/reserved IP
 * @throws {Error} "Internal hostnames are not allowed" if targeting an internal hostname
 */
export function assertSafeUrl(rawUrl: string): void {
  // Step 1: Parse URL — throws if invalid
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  // Step 2: Enforce HTTPS only
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs allowed');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Step 3: Check for private IPv4 ranges
  // Hostname may be a bare IP (e.g., 192.168.1.1) or bracketed IPv6 (e.g., [::1])
  const ipv4Match = hostname.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (ipv4Match) {
    const ip = ipv4Match[1];
    for (const pattern of PRIVATE_IPV4_PATTERNS) {
      if (pattern.test(ip)) {
        throw new Error('Private IP ranges are not allowed');
      }
    }
  }

  // Step 4: Check for private IPv6 ranges (hostname is already lowercase)
  // URL.hostname for IPv6 addresses strips the brackets: [::1] -> ::1
  const ipv6Candidate = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
  for (const pattern of PRIVATE_IPV6_PATTERNS) {
    if (pattern.test(ipv6Candidate)) {
      throw new Error('Private IP ranges are not allowed');
    }
  }

  // Step 5: Block known internal hostnames (exact match, case-insensitive)
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new Error('Internal hostnames are not allowed');
  }

  // Step 6: Block .internal and .local TLD suffixes (cloud metadata + mDNS)
  for (const suffix of BLOCKED_TLD_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      throw new Error('Internal hostnames are not allowed');
    }
  }
}
