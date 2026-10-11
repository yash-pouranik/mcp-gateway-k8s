import dns from 'node:dns/promises';
import { URL } from 'node:url';

const ALLOWED_INTERNAL_HOSTS = new Set([
  'woocommerce-mcp.woocommerce.svc.cluster.local',
  'fakestore-mcp.extra-mcps.svc.cluster.local',
  'notes-mcp.extra-mcps.svc.cluster.local',
  // Short names for in-cluster testing if configured
  'woocommerce-mcp.woocommerce.svc',
  'fakestore-mcp.extra-mcps.svc',
  'notes-mcp.extra-mcps.svc'
]);

/**
 * Check if IP address is in private (RFC 1918), loopback, or link-local ranges
 */
function isPrivateOrReservedIp(ip: string): boolean {
  // Check loopback (127.0.0.0/8) or ::1
  if (ip.startsWith('127.') || ip === '::1' || ip === '0.0.0.0') return true;
  
  // Link-local / metadata (169.254.0.0/16)
  if (ip.startsWith('169.254.')) return true;
  
  // RFC 1918 private ranges
  // 10.0.0.0/8
  if (ip.startsWith('10.')) return true;
  // 172.16.0.0/12 (172.16.0.0 – 172.31.255.255)
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  // 192.168.0.0/16
  if (ip.startsWith('192.168.')) return true;
  
  return false;
}

/**
 * Validates a target URL against SSRF attacks.
 * Allows explicitly allowed in-cluster service hostnames,
 * and validates external URLs by resolving DNS and blocking private/loopback/cloud metadata IP ranges.
 */
export async function validateServerUrl(urlString: string): Promise<void> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch (err) {
    throw new Error(`Invalid URL format: ${urlString}`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only http and https are allowed.`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Allow explicitly registered internal cluster services
  if (ALLOWED_INTERNAL_HOSTS.has(hostname)) {
    return;
  }

  // If someone targets cluster internal domains without being on allowlist, reject
  if (hostname.endsWith('.cluster.local') || hostname.endsWith('.svc') || hostname.endsWith('.internal')) {
    throw new Error(`Access to unapproved cluster internal hostname "${hostname}" is prohibited.`);
  }

  // Resolve hostname via DNS and ensure it does not point to internal/loopback/metadata
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const record of addresses) {
      if (isPrivateOrReservedIp(record.address)) {
        throw new Error(`SSRF guard blocked target: Host "${hostname}" resolves to private/reserved IP "${record.address}"`);
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('SSRF guard blocked')) {
      throw err;
    }
    throw new Error(`Could not resolve hostname "${hostname}": ${err.message}`);
  }
}
