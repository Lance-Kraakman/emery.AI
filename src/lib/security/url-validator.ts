/**
 * SSRF Protection: URL validation utilities
 *
 * Shared validation for any server-side outbound fetch to user-controlled URLs.
 * Blocks private IPs, internal hostnames, and non-HTTP protocols.
 */

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT
];

const PRIVATE_IPV6_PATTERNS = [
  /^::1$/, // Loopback
  /^fc/, // Unique local (fc00::/7)
  /^fd/, // Unique local (fc00::/7)
  /^fe[89ab]/i, // Link-local (fe80::/10)
];

const BLOCKED_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost'];

/**
 * Check if a URL points to a private/internal network address.
 *
 * Validates against:
 * - Localhost (127.0.0.1, ::1, localhost)
 * - RFC 1918 private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)
 * - IPv6 private ranges (fc00::/7, fe80::/10)
 * - Link-local, carrier-grade NAT, current network
 * - Internal hostnames (.local, .internal, .localhost, no dots)
 */
export function isPrivateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Block non-HTTP protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return true;
    }

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    // Block private IPv4 ranges
    for (const range of PRIVATE_IPV4_RANGES) {
      if (range.test(hostname)) {
        return true;
      }
    }

    // Block private IPv6 ranges
    // Strip brackets if present (URL parser may include them for IPv6)
    const cleanHostname = hostname.replace(/^\[|\]$/g, '');
    for (const pattern of PRIVATE_IPV6_PATTERNS) {
      if (pattern.test(cleanHostname)) {
        return true;
      }
    }

    // Block internal hostnames (no dots or ends with .local, .internal, etc.)
    if (!hostname.includes('.')) {
      return true;
    }
    for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
      if (hostname.endsWith(suffix)) {
        return true;
      }
    }

    return false;
  } catch {
    return true; // Invalid URL — block it
  }
}

/**
 * Validate a URL is safe for server-side fetch (SSRF protection).
 * Returns an error message if unsafe, null if safe.
 */
export function validateOutboundUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'Only HTTP/HTTPS URLs are allowed';
    }
  } catch {
    return 'Invalid URL format';
  }

  if (isPrivateUrl(url)) {
    return 'Cannot make requests to private/internal URLs';
  }

  return null;
}
