import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { RegisteredUser, TransactionAudit } from '../../domain/types';

export interface ConnectedWallet {
  getUnshieldedAddress: () => Promise<{ unshieldedAddress: string } | string>;
  getShieldedAddresses?: () => Promise<{
    shieldedAddress?: string;
    shieldedCoinPublicKey?: string;
    shieldedEncryptionPublicKey?: string;
  } | string[]>;
  getConnectionStatus?: () => Promise<{ status: string; networkId?: string } | { networkId?: string }>;
  balanceUnsealedTransaction?: (tx: unknown, options?: unknown) => Promise<unknown>;
  submitTransaction?: (tx: unknown) => Promise<string | void>;
  hintUsage?: (methodNames: string[]) => Promise<void>;
}

export interface DiscoveredWallet {
  id: string;
  name: string;
  icon?: string;
  rdns?: string;
  apiVersion: string;
  connect: (networkId?: string) => Promise<ConnectedWallet>;
}

export interface WalletAccountInfo {
  unshieldedAddress: string;
  shieldedAddress?: string;
  shieldedCoinPublicKey?: string;
  shieldedEncryptionPublicKey?: string;
  networkId: string;
}

type WalletCandidate = {
  name?: string;
  icon?: string;
  rdns?: string;
  apiVersion?: string;
  connect?: (networkId?: string) => Promise<ConnectedWallet>;
};

declare global {
  interface Window {
    midnight?: Record<string, WalletCandidate>;
  }
}

export function isCompatibleConnectorVersion(version: string | undefined): boolean {
  if (!version) return false;
  const match = version.trim().match(/^v?(\d+)/);
  if (!match) return false;
  return parseInt(match[1], 10) === 4;
}

export function discoverInjectedWallets(): DiscoveredWallet[] {
  if (typeof window === 'undefined') return [];
  const injected = window.midnight;
  if (!injected || typeof injected !== 'object') return [];

  return Object.entries(injected)
    .filter((entry): entry is [string, WalletCandidate & { connect: (networkId?: string) => Promise<ConnectedWallet> }] => {
      return typeof entry[1]?.connect === 'function' && isCompatibleConnectorVersion(entry[1].apiVersion);
    })
    .map(([id, wallet]) => ({
      id,
      name: typeof wallet.name === 'string' && wallet.name.trim() ? wallet.name : `Midnight Wallet (${id.slice(0, 6)})`,
      icon: typeof wallet.icon === 'string' ? wallet.icon : undefined,
      rdns: typeof wallet.rdns === 'string' ? wallet.rdns : undefined,
      apiVersion: typeof wallet.apiVersion === 'string' ? wallet.apiVersion : '4.0.0',
      connect: wallet.connect.bind(wallet),
    }));
}

export async function connectAndValidateWallet(
  wallet: DiscoveredWallet,
  targetNetwork: string = 'preprod'
): Promise<{ walletApi: ConnectedWallet; account: WalletAccountInfo }> {
  try {
    setNetworkId(targetNetwork);
  } catch (err) {
    console.warn('Network ID setup warning:', err);
  }

  const walletApi = await wallet.connect(targetNetwork);

  if (typeof walletApi.hintUsage === 'function') {
    try {
      await walletApi.hintUsage([
        'getUnshieldedAddress',
        'getShieldedAddresses',
        'getConnectionStatus',
        'balanceUnsealedTransaction',
        'submitTransaction',
      ]);
    } catch {
      // Non-fatal if wallet prompts on demand
    }
  }

  let reportedNetwork = targetNetwork;
  if (typeof walletApi.getConnectionStatus === 'function') {
    try {
      const status = await walletApi.getConnectionStatus();
      if ('networkId' in status && status.networkId) {
        reportedNetwork = status.networkId;
      }
    } catch {
      // Non-fatal fallback
    }
  }

  const rawUnshielded = await walletApi.getUnshieldedAddress();
  const unshieldedAddress =
    typeof rawUnshielded === 'object' && rawUnshielded !== null && 'unshieldedAddress' in rawUnshielded
      ? (rawUnshielded as { unshieldedAddress: string }).unshieldedAddress
      : String(rawUnshielded || '');

  let shieldedInfo: { shieldedAddress?: string; shieldedCoinPublicKey?: string; shieldedEncryptionPublicKey?: string } = {};
  if (typeof walletApi.getShieldedAddresses === 'function') {
    try {
      const rawShielded = await walletApi.getShieldedAddresses();
      if (rawShielded && typeof rawShielded === 'object' && !Array.isArray(rawShielded)) {
        shieldedInfo = rawShielded as typeof shieldedInfo;
      }
    } catch {
      // Shielded addresses optional in demo mode
    }
  }

  return {
    walletApi,
    account: {
      unshieldedAddress,
      shieldedAddress: shieldedInfo.shieldedAddress,
      shieldedCoinPublicKey: shieldedInfo.shieldedCoinPublicKey,
      shieldedEncryptionPublicKey: shieldedInfo.shieldedEncryptionPublicKey,
      networkId: reportedNetwork,
    },
  };
}

export function safeWalletLabel(wallet: Pick<DiscoveredWallet, 'name' | 'id'>): string {
  const normalizedName = wallet.name.replace(/[<>]/g, '').trim().slice(0, 48);
  return normalizedName || `Wallet ${wallet.id.slice(0, 6)}`;
}

const usersStorageKey = 'prooffactor.admin.users';
const auditsStorageKey = 'prooffactor.admin.audit';

export function readRegisteredUsers(): RegisteredUser[] {
  return readStorage(usersStorageKey);
}

export function readTransactionAudits(): TransactionAudit[] {
  return readStorage(auditsStorageKey);
}

export function saveRegisteredUser(user: RegisteredUser) {
  writeStorage(usersStorageKey, [user, ...readRegisteredUsers().filter((item) => item.id !== user.id)]);
}

export function saveTransactionAudit(audit: TransactionAudit) {
  writeStorage(auditsStorageKey, [audit, ...readTransactionAudits()]);
}

function readStorage<T>(key: string): T[] {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T[]) : [];
  } catch {
    return [];
  }
}

function writeStorage<T>(key: string, value: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage is optional
  }
}
