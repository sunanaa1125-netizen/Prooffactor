import { ArrowRight, UserRound, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { discoverInjectedWallets, safeWalletLabel, type DiscoveredWallet } from '../lib/midnight/wallets';

interface Props {
  open: boolean;
  wallets: DiscoveredWallet[];
  onSelect: (wallet: DiscoveredWallet | null, displayName: string) => void;
  onClose: () => void;
  collectDisplayName?: boolean;
}

export function WalletDialog({ open, wallets: initialWallets, onSelect, onClose, collectDisplayName = true }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [activeWallets, setActiveWallets] = useState<DiscoveredWallet[]>(initialWallets);

  useEffect(() => {
    if (open) {
      setDisplayName('');
      setNameSubmitted(!collectDisplayName);
      setActiveWallets(discoverInjectedWallets());

      // Poll periodically for 3 seconds to catch asynchronously injected extensions
      const interval = window.setInterval(() => {
        const found = discoverInjectedWallets();
        setActiveWallets((prev) => {
          if (found.length !== prev.length) return found;
          return prev;
        });
      }, 400);

      const timeout = window.setTimeout(() => window.clearInterval(interval), 3000);

      return () => {
        window.clearInterval(interval);
        window.clearTimeout(timeout);
      };
    }
  }, [collectDisplayName, open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function continueToWallets(event: FormEvent) {
    event.preventDefault();
    if (displayName.trim()) setNameSubmitted(true);
  }

  const wallets = activeWallets.length > 0 ? activeWallets : initialWallets;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="dialog dialog--small" role="dialog" aria-modal="true" aria-labelledby="wallet-title">
        <header className="dialog__header">
          <div>
            <p className="eyebrow">Midnight connector</p>
            <h2 id="wallet-title">Choose a wallet</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close wallet chooser">
            <X />
          </button>
        </header>
        <div className="dialog__body">
          {!nameSubmitted ? (
            <form onSubmit={continueToWallets} className="wallet-name-form">
              <div className="privacy-callout">
                <UserRound size={18} />
                <div>
                  <strong>Identify this workspace session</strong>
                  <p>Your name is stored locally for the admin activity register. It is not sent to the Midnight contract.</p>
                </div>
              </div>
              <label className="field field--wide">
                Display name
                <span>Use a team name or safe alias.</span>
                <input
                  aria-label="Display name"
                  autoFocus
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="e.g. Maya Chen"
                  required
                />
              </label>
              <footer className="dialog__footer">
                <button type="button" className="button button--secondary" onClick={onClose}>
                  Cancel
                </button>
                <button className="button button--primary" type="submit">
                  Continue <ArrowRight size={15} />
                </button>
              </footer>
            </form>
          ) : wallets.length > 0 ? (
            <>
              <p className="wallet-dialog__note">
                Supports Midnight DApp Connector API v4 wallets, including compatible Lace or 1AM extensions.
              </p>
              {wallets.map((wallet) => (
                <button className="wallet-option" key={wallet.id} onClick={() => onSelect(wallet, displayName.trim())}>
                  <span>
                    <strong>{safeWalletLabel(wallet)}</strong>
                    <small>Connector API {wallet.apiVersion} · Preprod</small>
                  </span>
                  <code>{wallet.id.slice(0, 12)}…</code>
                </button>
              ))}
              <button
                className="button button--secondary wallet-dialog__demo"
                onClick={() => onSelect(null, displayName.trim())}
              >
                Use demo wallet instead
              </button>
            </>
          ) : (
            <div className="empty-state">
              <strong>No compatible Midnight wallet detected.</strong>
              <p>
                Install a Lace or 1AM extension that exposes Midnight DApp Connector API v4, or continue with the clearly labeled demo wallet.
              </p>
              <button className="button button--primary" onClick={() => onSelect(null, displayName.trim())}>
                Use demo wallet
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

