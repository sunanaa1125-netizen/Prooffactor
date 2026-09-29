import type { Invoice, InvoiceStatus, NewInvoiceInput } from './types';
import { generateSecureSalt, getNextBlockHeight, sha256HexSync } from './crypto';

const allowedTransitions: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  PROPOSED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PENDING_FINANCING', 'PAID', 'CANCELLED', 'EXPIRED'],
  PENDING_FINANCING: ['ACCEPTED', 'FINANCED_CONFIRMED', 'EXPIRED'],
  FINANCED_CONFIRMED: ['PAID'],
  PAID: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function transitionInvoice(
  invoice: Invoice,
  next: InvoiceStatus,
  metadata?: {
    nullifier?: string | null;
    policyId?: string | null;
    txHash?: string;
    dustFee?: number;
    nightFee?: number;
    blockHeight?: number;
  }
): Invoice {
  if (!allowedTransitions[invoice.status].includes(next)) {
    throw new Error(`Invalid invoice transition: ${invoice.status} -> ${next}`);
  }

  const now = Date.now();
  const nextTxHash = metadata?.txHash || sha256HexSync(`tx:${next}:${invoice.commitment}:${now}`);
  const nextBlockHeight = metadata?.blockHeight ?? getNextBlockHeight();

  return {
    ...invoice,
    status: next,
    nullifier: metadata?.nullifier !== undefined ? metadata.nullifier : invoice.nullifier,
    policyId: metadata?.policyId !== undefined ? metadata.policyId : invoice.policyId,
    updatedAt: 'Just now',
    proofVerified: next === 'PENDING_FINANCING' || next === 'FINANCED_CONFIRMED' ? true : invoice.proofVerified,
    txHash: nextTxHash,
    blockHeight: nextBlockHeight,
    timestamp: now,
    dustFee: metadata?.dustFee ?? (next === 'PENDING_FINANCING' ? 1250 : 850),
    nightFee: metadata?.nightFee ?? (next === 'PENDING_FINANCING' ? 0.0058 : 0.0042),
  };
}


export function createDemoInvoice(input: NewInvoiceInput, ordinal: number, customSalt?: string): Invoice {
  const amountMinor = Math.round(Number(input.amount) * 100);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new Error('Invoice amount must be greater than zero.');
  }

  const salt = customSalt || sha256HexSync(`salt|${input.alias}|${input.buyerAlias}|${input.dueDate}|${ordinal}`);
  const canonicalDemoInput = [
    input.alias.trim(),
    input.buyerAlias.trim(),
    amountMinor,
    input.currency,
    input.dueDate,
    salt,
  ].join('|');

  const commitment = sha256HexSync(`prooffactor:invoice:v1:${canonicalDemoInput}`);
  const now = Date.now();
  const txHash = sha256HexSync(`tx:registerInvoice:${commitment}:${now}`);

  return {
    id: `invoice-${ordinal}-${commitment.slice(2, 8)}`,
    alias: input.alias.trim(),
    supplierAlias: 'Northstar Supply',
    buyerAlias: input.buyerAlias.trim(),
    commitment,
    nullifier: null,
    status: 'PROPOSED',
    currency: input.currency,
    amountMinor,
    dueWindow: 'Pending buyer review',
    dueDate: input.dueDate,
    updatedAt: 'Just now',
    policyId: null,
    proofVerified: false,
    txHash,
    blockHeight: getNextBlockHeight(),
    timestamp: now,
    dustFee: 420,
    nightFee: 0.0031,
    salt,
  };
}

export function isPolicyEligible(invoice: Invoice, minMinor: number, maxMinor: number, currency: Invoice['currency']): boolean {
  return (
    invoice.status === 'ACCEPTED' &&
    invoice.currency === currency &&
    invoice.amountMinor >= minMinor &&
    invoice.amountMinor <= maxMinor
  );
}
