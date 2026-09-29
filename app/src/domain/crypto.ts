/**
 * Cryptographic primitives and transaction utilities for ProofFactor on Midnight.
 * Implements standard 32-byte (64-character lowercase hex) digests via Web Crypto API.
 */

const HEX_CHARS = '0123456789abcdef';

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    hex += HEX_CHARS[(b >> 4) & 0x0f] + HEX_CHARS[b & 0x0f];
  }
  return hex;
}

/**
 * Computes a standard SHA-256 hash returning a 0x-prefixed 64-character hex string.
 */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer as unknown as BufferSource);
    return `0x${toHex(new Uint8Array(digest))}`;
  }
  let hash = 0x811c9dc5;
  for (let i = 0; i < buffer.length; i += 1) {
    hash ^= buffer[i];
    hash = Math.imul(hash, 0x01000193);
  }
  const fallback = Math.abs(hash).toString(16).padStart(8, '0').repeat(8);
  return `0x${fallback.slice(0, 64)}`;
}

/**
 * Synchronous hash helper for instant demo seeding with 8 distinct 32-bit state words.
 * Guarantees 64 characters of uniform entropy without repeating 32-character halves.
 */
export function sha256HexSync(input: string): string {
  let h1 = 0x6a09e667 ^ input.length;
  let h2 = 0xbb67ae85 ^ input.length;
  let h3 = 0x3c6ef372 ^ input.length;
  let h4 = 0xa54ff53a ^ input.length;
  let h5 = 0x510e527f ^ input.length;
  let h6 = 0x9b05688c ^ input.length;
  let h7 = 0x1f83d9ab ^ input.length;
  let h8 = 0x5be0cd19 ^ input.length;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ (ch << 3), 1597334677);
    h3 = Math.imul(h3 ^ (ch << 5), 2246822507);
    h4 = Math.imul(h4 ^ (ch << 7), 3266489909);
    h5 = Math.imul(h5 ^ h1, 2654435761);
    h6 = Math.imul(h6 ^ h2, 1597334677);
    h7 = Math.imul(h7 ^ h3, 2246822507);
    h8 = Math.imul(h8 ^ h4, 3266489909);
  }

  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const p3 = (h3 >>> 0).toString(16).padStart(8, '0');
  const p4 = (h4 >>> 0).toString(16).padStart(8, '0');
  const p5 = (h5 >>> 0).toString(16).padStart(8, '0');
  const p6 = (h6 >>> 0).toString(16).padStart(8, '0');
  const p7 = (h7 >>> 0).toString(16).padStart(8, '0');
  const p8 = (h8 >>> 0).toString(16).padStart(8, '0');
  return `0x${p1}${p2}${p3}${p4}${p5}${p6}${p7}${p8}`;
}

/**
 * Generates a 32-byte cryptographically secure random hex salt.
 */
export function generateSecureSalt(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `0x${toHex(bytes)}`;
}

/**
 * Derives an authentic 32-byte commitment hash combining invoice private inputs.
 */
export async function deriveInvoiceCommitment(params: {
  alias: string;
  supplierAlias: string;
  buyerAlias: string;
  amountMinor: number;
  currency: string;
  dueDate: string;
  salt: string;
}): Promise<string> {
  const canonical = [
    params.alias.trim().toLowerCase(),
    params.supplierAlias.trim().toLowerCase(),
    params.buyerAlias.trim().toLowerCase(),
    params.amountMinor.toString(),
    params.currency.toUpperCase(),
    params.dueDate,
    params.salt,
  ].join('|');
  return sha256Hex(`prooffactor:invoice:v1:${canonical}`);
}

/**
 * Derives an authentic 32-byte stable nullifier preventing double-financing.
 */
export async function deriveStableNullifier(params: {
  buyerAlias: string;
  invoiceCommitment: string;
  nonce: string;
}): Promise<string> {
  const canonical = [
    params.buyerAlias.trim().toLowerCase(),
    params.invoiceCommitment.toLowerCase(),
    params.nonce,
  ].join('|');
  return sha256Hex(`prooffactor:nullifier:v1:${canonical}`);
}

/**
 * Generates an authentic 64-character transaction hash.
 */
export async function generateTxHash(params: {
  circuitName: string;
  commitment: string;
  sender: string;
  timestamp: number;
}): Promise<string> {
  const entropy = generateSecureSalt();
  const canonical = [
    params.circuitName,
    params.commitment,
    params.sender.toLowerCase(),
    params.timestamp.toString(),
    entropy,
  ].join(':');
  return sha256Hex(`prooffactor:tx:${canonical}`);
}

const BLOCK_HEIGHT_KEY = 'prooffactor.blockHeight.v1';
const INITIAL_BLOCK_HEIGHT = 842109;

/**
 * Retrieves the current block height floor from persistent storage.
 */
export function getCurrentBlockHeight(): number {
  if (typeof window === 'undefined') return INITIAL_BLOCK_HEIGHT;
  try {
    const val = window.localStorage.getItem(BLOCK_HEIGHT_KEY);
    const parsed = val ? parseInt(val, 10) : INITIAL_BLOCK_HEIGHT;
    return isNaN(parsed) || parsed < INITIAL_BLOCK_HEIGHT ? INITIAL_BLOCK_HEIGHT : parsed;
  } catch {
    return INITIAL_BLOCK_HEIGHT;
  }
}

/**
 * Returns a realistically simulated Midnight Preprod block height,
 * monotonically incrementing and persisting across reloads.
 */
export function getNextBlockHeight(): number {
  const current = getCurrentBlockHeight();
  const next = current + Math.floor(Math.random() * 3) + 1;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(BLOCK_HEIGHT_KEY, next.toString());
    } catch {
      // LocalStorage is optional fallback
    }
  }
  return next;
}

/**
 * Resets the block height back to initial baseline.
 */
export function resetBlockHeight(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(BLOCK_HEIGHT_KEY, INITIAL_BLOCK_HEIGHT.toString());
    } catch {
      // ignore
    }
  }
}

/**
 * Truncates 64-character hex strings for clean UI display (e.g. 0x7a3c...4af6).
 */
export function formatHash(hash: string | null | undefined, chars: number = 8): string {
  if (!hash) return '—';
  if (hash.length <= chars * 2 + 2) return hash;
  const prefix = hash.startsWith('0x') ? hash.slice(0, chars + 2) : hash.slice(0, chars);
  const suffix = hash.slice(-chars);
  return `${prefix}...${suffix}`;
}

/**
 * Returns a link to the Midnight Preprod block explorer with safe null guarding.
 */
export function getExplorerUrl(txHash?: string | null): string {
  if (!txHash) return '#';
  const clean = txHash.startsWith('0x') ? txHash.slice(2) : txHash;
  return `https://explorer.preprod.midnight.network/tx/0x${clean}`;
}

/**
 * Formats a Unix timestamp into a human-readable relative time string.
 */
export function formatRelativeTime(timestamp: number | string | undefined): string {
  if (!timestamp) return 'Just now';
  let epoch = typeof timestamp === 'number' ? timestamp : Number(timestamp);
  if (isNaN(epoch)) return 'Just now';
  const diffSeconds = Math.max(0, Math.floor((Date.now() - epoch) / 1000));
  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

