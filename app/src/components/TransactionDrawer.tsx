import { Check, Copy, ExternalLink, LoaderCircle, X } from 'lucide-react';
import { useState } from 'react';
import type { Invoice, TransactionStage } from '../domain/types';
import { formatHash, getExplorerUrl } from '../domain/crypto';
import { PrivacyTag } from './PrivacyTag';

interface Props {
  open: boolean;
  invoice: Invoice | null;
  stages: TransactionStage[];
  actionTitle?: string;
  onClose: () => void;
}

export function TransactionDrawer({ open, invoice, stages, actionTitle = 'Private policy check', onClose }: Props) {
  const [copied, setCopied] = useState(false);

  if (!open || !invoice) return null;

  const isComplete = stages.every((stage) => stage.state === 'complete');

  const handleCopyHash = () => {
    if (invoice.txHash) {
      navigator.clipboard.writeText(invoice.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <aside className="transaction-drawer" aria-labelledby="transaction-title">
      <header className="transaction-drawer__header">
        <div>
          <p className="eyebrow">Transaction progress</p>
          <h2 id="transaction-title">{actionTitle}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close transaction progress">
          <X />
        </button>
      </header>
      <div className="transaction-drawer__body">
        <div className="local-summary">
          <div>
            <strong>{invoice.alias}</strong>
            <PrivacyTag level="LOCAL ONLY" />
          </div>
          <p>Private invoice fields are prepared locally. Only zero-knowledge proof outputs and public state transitions are submitted to the Midnight ledger.</p>
        </div>

        <ol className="progress-list" aria-live="polite">
          {stages.map((stage, index) => (
            <li className={`progress-step progress-step--${stage.state}`} key={stage.id}>
              <span className="progress-step__marker" aria-hidden="true">
                {stage.state === 'complete' ? (
                  <Check size={14} />
                ) : stage.state === 'active' ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  index + 1
                )}
              </span>
              <div>
                <strong>{stage.label}</strong>
                <p>{stage.description}</p>
                {stage.id === 'proof' && <PrivacyTag level="PROVED, NOT SHARED" />}
              </div>
            </li>
          ))}
        </ol>

        {isComplete && invoice.txHash && (
          <div className="local-summary" style={{ borderLeft: '3px solid var(--forest, #173b2c)', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="eyebrow" style={{ color: 'var(--forest, #173b2c)', fontWeight: 600 }}>
                Midnight Preprod Receipt
              </span>
              <span className="badge" style={{ fontSize: '11px', padding: '2px 6px' }}>
                Block #{invoice.blockHeight}
              </span>
            </div>
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted, #66706a)' }}>Tx Hash:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <code style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                    {formatHash(invoice.txHash, 6)}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    className="icon-button"
                    style={{ padding: '2px', width: '22px', height: '22px' }}
                    title="Copy full transaction hash"
                  >
                    <Copy size={12} />
                  </button>
                  <a
                    href={getExplorerUrl(invoice.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="icon-button"
                    style={{ padding: '2px', width: '22px', height: '22px' }}
                    title="View on Midnight Preprod Explorer"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
              {copied && <span style={{ fontSize: '11px', color: '#166534' }}>Full 64-char transaction hash copied!</span>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted, #66706a)', marginTop: '4px' }}>
                <span>Gas: {invoice.dustFee || 850} DUST</span>
                <span>Fee: {invoice.nightFee || 0.0042} NIGHT</span>
              </div>
            </div>
          </div>
        )}

        <div className="technical-note">
          <span className="eyebrow">Zero-Knowledge Guarantee</span>
          <p>Verification is confirmed by the smart contract without disclosing invoice face value, due date, or counterparty identities.</p>
        </div>
      </div>
    </aside>
  );
}
