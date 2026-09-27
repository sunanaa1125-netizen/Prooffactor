export type Role = 'supplier' | 'buyer' | 'lender' | 'viewer';

export type Section = 'overview' | 'invoices' | 'policies' | 'requests' | 'explorer' | 'demo' | 'admin';

export type InvoiceStatus =
  | 'PROPOSED'
  | 'ACCEPTED'
  | 'PENDING_FINANCING'
  | 'FINANCED_CONFIRMED'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PrivacyLevel = 'LOCAL ONLY' | 'PROVED, NOT SHARED' | 'PUBLIC ON-CHAIN';

export interface Invoice {
  id: string;
  alias: string;
  supplierAlias: string;
  buyerAlias: string;
  commitment: string;
  nullifier: string | null;
  status: InvoiceStatus;
  currency: 'USD' | 'EUR' | 'GBP';
  amountMinor: number;
  dueWindow: string;
  dueDate: string;
  updatedAt: string;
  policyId: string | null;
  proofVerified: boolean;
  txHash: string;
  blockHeight: number;
  timestamp: number;
  dustFee: number;
  nightFee: number;
  salt: string;
  buyerNullifierNonce?: string;
}

export interface Policy {
  id: string;
  lenderAlias: string;
  currency: Invoice['currency'];
  minMinor: number;
  maxMinor: number;
  maxRemainingDays: number;
  active: boolean;
}

export type TransactionStageId = 'proof' | 'wallet' | 'submit' | 'finality';
export type TransactionStageState = 'waiting' | 'active' | 'complete' | 'error';

export interface TransactionStage {
  id: TransactionStageId;
  label: string;
  description: string;
  state: TransactionStageState;
}

export interface ActivityItem {
  id: string;
  invoiceAlias: string;
  message: string;
  timestamp: string;
  txHash?: string;
  blockHeight?: number;
}

export interface RegisteredUser {
  id: string;
  displayName: string;
  walletName: string;
  walletId: string;
  walletAddress: string;
  role: Role;
  connectedAt: string;
  demo: boolean;
}

export interface TransactionAudit {
  id: string;
  userName: string;
  walletAddress: string;
  invoiceAlias: string;
  action: string;
  timestamp: string;
  demo: boolean;
  txHash?: string;
  blockHeight?: number;
}

export interface TransactionReceipt {
  txHash: string;
  blockHeight: number;
  timestamp: number;
  circuitName: string;
  dustFee: number;
  nightFee: number;
  status: 'CONFIRMED' | 'PENDING' | 'FAILED';
}

export interface NewInvoiceInput {
  alias: string;
  buyerAlias: string;
  amount: string;
  currency: Invoice['currency'];
  dueDate: string;
}
