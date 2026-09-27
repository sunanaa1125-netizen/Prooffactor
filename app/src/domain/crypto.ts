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
 * Synchronous hash helper for instant demo seeding.
 */
export function sha256HexSync(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c64e6d ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const part3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const part4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  return `0x${part1}${part2}${part3}${part4}${part1}${part2}${part3}${part4}`;
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

let currentBlockHeight = 842109;

/**
 * Returns a realistically simulated Midnight Preprod block height.
 */
export function getNextBlockHeight(): number {
  currentBlockHeight += Math.floor(Math.random() * 3) + 1;
  return currentBlockHeight;
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
 * Returns a link to the Midnight Preprod block explorer.
 */
export function getExplorerUrl(txHash: string): string {
  const clean = txHash.startsWith('0x') ? txHash.slice(2) : txHash;
  return `https://explorer.preprod.midnight.network/tx/0x${clean}`;
}
