import { useMemo, useRef, useState, useEffect } from 'react';
import {
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  Copy,
  ExternalLink,
  EyeOff,
  Files,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  Map,
  Plus,
  Radio,
  RotateCcw,
  ScanSearch,
  Send,
  WalletCards,
} from 'lucide-react';
import { BrandMark } from './components/BrandMark';
import { PrivacyTag } from './components/PrivacyTag';
import { RegisterInvoiceDialog } from './components/RegisterInvoiceDialog';
import { StatusBadge } from './components/StatusBadge';
import { TransactionDrawer } from './components/TransactionDrawer';
import { WalletDialog } from './components/WalletDialog';
import { demoPolicies, roleLabels, transactionStages } from './domain/demo-data';
import { createDemoInvoice, isPolicyEligible, transitionInvoice } from './domain/demo-machine';
import { deriveStableNullifier, formatHash, generateSecureSalt, generateTxHash, getExplorerUrl, getNextBlockHeight } from './domain/crypto';
import { loadStoredActivity, loadStoredInvoices, resetStoredData, saveStoredActivity, saveStoredInvoices } from './domain/storage';
import type { ActivityItem, Invoice, NewInvoiceInput, RegisteredUser, Role, Section, TransactionAudit, TransactionStage } from './domain/types';
import { discoverInjectedWallets, saveRegisteredUser, saveTransactionAudit, type DiscoveredWallet, safeWalletLabel } from './lib/midnight/wallets';

const navItems: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices', icon: Files },
  { id: 'policies', label: 'Policies', icon: ListChecks },
  { id: 'requests', label: 'Requests', icon: Send },
  { id: 'explorer', label: 'Explorer', icon: ScanSearch },
  { id: 'demo', label: 'Demo guide', icon: Map },
];

const roleCopy: Record<Role, { eyebrow: string; heading: string; body: string }> = {
  supplier: { eyebrow: 'Supplier operations', heading: 'Good morning, Northstar.', body: 'Register private commitments and request financing without disclosing commercial details.' },
  buyer: { eyebrow: 'Buyer review queue', heading: 'Review acknowledged invoices.', body: 'Match off-chain invoice data to its commitment before accepting or rejecting the public lifecycle.' },
  lender: { eyebrow: 'Lender decision queue', heading: 'Confirm proof-qualified requests.', body: 'Review policy evidence and pending locks without collecting the supplier’s private invoice.' },
  viewer: { eyebrow: 'Public explorer', heading: 'Inspect lifecycle integrity.', body: 'View public commitments and state transitions without gaining access to commercial invoice data.' },
};

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function App({ initialSection = 'overview' }: { initialSection?: Section }) {
  const [role, setRole] = useState<Role>('supplier');
  const [section, setSection] = useState<Section>(initialSection);
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadStoredInvoices());
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(() => {
    const stored = loadStoredInvoices();
    return stored.length > 0 ? stored[0].id : '';
  });
  const [activity, setActivity] = useState<ActivityItem[]>(() => loadStoredActivity());
  const [registerOpen, setRegisterOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [walletLabel, setWalletLabel] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [demoWallet, setDemoWallet] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('Transaction progress');
  const [activeTxInvoice, setActiveTxInvoice] = useState<Invoice | null>(null);
  const [stages, setStages] = useState<TransactionStage[]>(transactionStages);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<number | null>(null);

  // Sync state to localStorage whenever invoices or activity change
  useEffect(() => {
    saveStoredInvoices(invoices);
  }, [invoices]);

  useEffect(() => {
    saveStoredActivity(activity);
  }, [activity]);

  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? invoices[0] ?? null;
  const acceptedCount = invoices.filter((invoice) => invoice.status === 'ACCEPTED').length;
  const pendingCount = invoices.filter((invoice) => invoice.status === 'PENDING_FINANCING').length;
  const actionableCount = role === 'supplier' ? acceptedCount : role === 'buyer' ? invoices.filter((invoice) => invoice.status === 'PROPOSED').length : role === 'lender' ? pendingCount : 0;

  const visibleInvoices = useMemo(() => {
    if (role === 'buyer') return invoices.filter((invoice) => ['PROPOSED', 'ACCEPTED', 'REJECTED', 'PAID'].includes(invoice.status));
    if (role === 'lender') return invoices.filter((invoice) => ['PENDING_FINANCING', 'FINANCED_CONFIRMED'].includes(invoice.status));
    return invoices;
  }, [invoices, role]);

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3600);
  }

  function recordAudit(invoiceAlias: string, action: string, txHash?: string, blockHeight?: number) {
    const audit: TransactionAudit = {
      id: crypto.randomUUID(),
      userName: displayName || 'Demo operator',
      walletAddress: walletAddress || 'Demo wallet',
      invoiceAlias,
      action,
      timestamp: 'Just now',
      demo: demoWallet,
      txHash,
      blockHeight,
    };
    saveTransactionAudit(audit);
  }

  function openWalletChooser() {
    setWallets(discoverInjectedWallets());
    setWalletOpen(true);
  }

  async function chooseWallet(wallet: DiscoveredWallet | null, nextDisplayName: string) {
    setWalletOpen(false);
    if (!wallet) {
      setWalletLabel('Demo wallet (Preprod)');
      setWalletAddress('demo1zqqqq...preprod');
      setDisplayName(nextDisplayName);
      setDemoWallet(true);
      registerUser(nextDisplayName, 'Demo wallet', 'demo-wallet', 'demo1zqqqq...preprod', true);
      notify('Demo wallet connected. Transactions simulate real cryptographic proving.');
      return;
    }
    try {
      const connected = await wallet.connect('preprod');
      setWalletLabel(safeWalletLabel(wallet));
      setDisplayName(nextDisplayName);
      
      // Fix: Safely extract address string from API v4 object or string
      const rawAddress = connected?.getUnshieldedAddress ? await connected.getUnshieldedAddress() : '';
      const address = typeof rawAddress === 'object' && rawAddress !== null && 'unshieldedAddress' in rawAddress
        ? (rawAddress as { unshieldedAddress: string }).unshieldedAddress
        : String(rawAddress || '');
        
      setWalletAddress(address);
      registerUser(nextDisplayName, safeWalletLabel(wallet), wallet.id, address, false);
      setDemoWallet(false);
      notify(`${safeWalletLabel(wallet)} connected.`);
    } catch {
      notify('Wallet connection was cancelled or failed.');
    }
  }

  function registerUser(name: string, walletName: string, walletId: string, address: string, demo: boolean) {
    const user: RegisteredUser = {
      id: `${walletId}:${name.toLowerCase()}`,
      displayName: name,
      walletName,
      walletId,
      walletAddress: address,
      role,
      connectedAt: 'Just now',
      demo,
    };
    saveRegisteredUser(user);
  }

  async function runTransactionStages(title: string, invoice: Invoice): Promise<void> {
    setBusy(true);
    setDrawerTitle(title);
    setActiveTxInvoice(invoice);
    setDrawerOpen(true);
    setStages(transactionStages.map((stage, index) => ({ ...stage, state: index === 0 ? 'active' : 'waiting' })));

    for (let index = 0; index < transactionStages.length; index += 1) {
      await wait(500);
      setStages((current) =>
        current.map((stage, stageIndex) => ({
          ...stage,
          state: stageIndex <= index ? 'complete' : stageIndex === index + 1 ? 'active' : 'waiting',
        }))
      );
    }
    setBusy(false);
  }

  async function registerInvoice(input: NewInvoiceInput) {
    const newInvoice = createDemoInvoice(input, invoices.length + 1);
    setRegisterOpen(false);
    await runTransactionStages('Register Invoice Commitment', newInvoice);

    setInvoices((current) => [newInvoice, ...current]);
    setSelectedInvoiceId(newInvoice.id);
    setActiveTxInvoice(newInvoice);

    const newActivity: ActivityItem = {
      id: crypto.randomUUID(),
      invoiceAlias: newInvoice.alias,
      message: 'Committed to Midnight ledger with 32-byte salt',
      timestamp: 'Just now',
      txHash: newInvoice.txHash,
      blockHeight: newInvoice.blockHeight,
    };
    setActivity((current) => [newActivity, ...current]);
    recordAudit(newInvoice.alias, 'Registered commitment on-chain', newInvoice.txHash, newInvoice.blockHeight);
    setSection('invoices');
    notify(`Invoice ${newInvoice.alias} registered. Commitment: ${formatHash(newInvoice.commitment)}`);
  }

  async function buyerDecision(accepted: boolean) {
    if (!selectedInvoice || selectedInvoice.status !== 'PROPOSED') return;

    let updated = transitionInvoice(selectedInvoice, accepted ? 'ACCEPTED' : 'REJECTED');
    if (accepted) {
      const nonce = generateSecureSalt();
      const nullifier = await deriveStableNullifier({
        buyerAlias: selectedInvoice.buyerAlias,
        invoiceCommitment: selectedInvoice.commitment,
        nonce,
      });
      const txHash = await generateTxHash({
        circuitName: 'acceptInvoice',
        commitment: selectedInvoice.commitment,
        sender: selectedInvoice.buyerAlias,
        timestamp: Date.now(),
      });
      updated = {
        ...updated,
        nullifier,
        buyerNullifierNonce: nonce,
        txHash,
        blockHeight: getNextBlockHeight(),
      };
    }

    await runTransactionStages(accepted ? 'Buyer Invoice Acceptance' : 'Invoice Rejection', updated);

    setInvoices((current) => current.map((item) => (item.id === selectedInvoice.id ? updated : item)));
    setActiveTxInvoice(updated);

    const msg = accepted ? 'Buyer verified and issued stable nullifier' : 'Buyer rejected invoice';
    const newActivity: ActivityItem = {
      id: crypto.randomUUID(),
      invoiceAlias: updated.alias,
      message: msg,
      timestamp: 'Just now',
      txHash: updated.txHash,
      blockHeight: updated.blockHeight,
    };
    setActivity((current) => [newActivity, ...current]);
    recordAudit(updated.alias, msg, updated.txHash, updated.blockHeight);
    notify(msg);
  }

  async function lenderDecision(confirmed: boolean) {
    if (!selectedInvoice || selectedInvoice.status !== 'PENDING_FINANCING') return;

    const txHash = await generateTxHash({
      circuitName: confirmed ? 'confirmFinancing' : 'declineFinancing',
      commitment: selectedInvoice.commitment,
      sender: 'Lender',
      timestamp: Date.now(),
    });

    const updated = {
      ...transitionInvoice(selectedInvoice, confirmed ? 'FINANCED_CONFIRMED' : 'ACCEPTED'),
      txHash,
      blockHeight: getNextBlockHeight(),
      dustFee: confirmed ? 1450 : 600,
      nightFee: confirmed ? 0.0065 : 0.0028,
    };

    await runTransactionStages(confirmed ? 'Lender Financing Confirmation' : 'Release Financing Lock', updated);

    setInvoices((current) => current.map((item) => (item.id === selectedInvoice.id ? updated : item)));
    setActiveTxInvoice(updated);

    const msg = confirmed ? 'Financing confirmed; nullifier permanently consumed' : 'Lender declined; pending lock released';
    const newActivity: ActivityItem = {
      id: crypto.randomUUID(),
      invoiceAlias: updated.alias,
      message: msg,
      timestamp: 'Just now',
      txHash: updated.txHash,
      blockHeight: updated.blockHeight,
    };
    setActivity((current) => [newActivity, ...current]);
    recordAudit(updated.alias, msg, updated.txHash, updated.blockHeight);
    notify(msg);
  }

  async function requestFinancing(invoice: Invoice, policyId = 'greenline-v3') {
    const policy = demoPolicies.find((item) => item.id === policyId);
    if (!policy) return;

    if (!isPolicyEligible(invoice, policy.minMinor, policy.maxMinor, policy.currency)) {
      notify(`Invoice does not satisfy policy limits (Min: $${policy.minMinor / 100}, Max: $${policy.maxMinor / 100})`);
      return;
    }

    const txHash = await generateTxHash({
      circuitName: 'requestFinancing',
      commitment: invoice.commitment,
      sender: invoice.supplierAlias,
      timestamp: Date.now(),
    });

    const updated = {
      ...transitionInvoice(invoice, 'PENDING_FINANCING'),
      policyId,
      txHash,
      blockHeight: getNextBlockHeight(),
      dustFee: 1250,
      nightFee: 0.0058,
    };

    await runTransactionStages('Zero-Knowledge Policy Verification', updated);

    setInvoices((current) => current.map((item) => (item.id === invoice.id ? updated : item)));
    setActiveTxInvoice(updated);

    const msg = 'Zero-knowledge policy proof verified on-chain';
    const newActivity: ActivityItem = {
      id: crypto.randomUUID(),
      invoiceAlias: updated.alias,
      message: msg,
      timestamp: 'Just now',
      txHash: updated.txHash,
      blockHeight: updated.blockHeight,
    };
    setActivity((current) => [newActivity, ...current]);
    recordAudit(updated.alias, msg, updated.txHash, updated.blockHeight);
    notify('Proof generated and verified on Midnight ledger.');
  }

  async function markPaid() {
    if (!selectedInvoice || !['ACCEPTED', 'FINANCED_CONFIRMED'].includes(selectedInvoice.status)) return;

    const txHash = await generateTxHash({
      circuitName: 'markInvoicePaid',
      commitment: selectedInvoice.commitment,
      sender: selectedInvoice.buyerAlias,
      timestamp: Date.now(),
    });

    const updated = {
      ...transitionInvoice(selectedInvoice, 'PAID'),
      txHash,
      blockHeight: getNextBlockHeight(),
      dustFee: 500,
      nightFee: 0.003,
    };

    await runTransactionStages('Invoice Settlement Finality', updated);

    setInvoices((current) => current.map((item) => (item.id === selectedInvoice.id ? updated : item)));
    setActiveTxInvoice(updated);

    const msg = 'Invoice settlement finalized on-chain';
    const newActivity: ActivityItem = {
      id: crypto.randomUUID(),
      invoiceAlias: updated.alias,
      message: msg,
      timestamp: 'Just now',
      txHash: updated.txHash,
      blockHeight: updated.blockHeight,
    };
    setActivity((current) => [newActivity, ...current]);
    recordAudit(updated.alias, msg, updated.txHash, updated.blockHeight);
    notify(msg);
  }

  function handleResetData() {
    const fresh = resetStoredData();
    setInvoices(fresh.invoices);
    setActivity(fresh.activity);
    if (fresh.invoices.length > 0) setSelectedInvoiceId(fresh.invoices[0].id);
    notify('Demo state reset to clean seed invoices.');
  }

  const pageCopy = roleCopy[role];
  const activeLabel = navItems.find((item) => item.id === section)?.label ?? 'Overview';

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={() => setSection('overview')}><BrandMark /></button>
        <div className="topbar__actions">
          <span className="network-pill"><span />PREPROD</span>
          <span className="privacy-workspace"><EyeOff size={14} />PRIVATE WORKSPACE</span>
          <label className="role-select">
            <span className="sr-only">Selected role</span>
            <select value={role} onChange={(event) => { setRole(event.target.value as Role); setSection('overview'); }}>
              <option value="supplier">Supplier</option>
              <option value="buyer">Buyer</option>
              <option value="lender">Lender</option>
              <option value="viewer">Public viewer</option>
            </select>
            <ChevronDown size={14} />
          </label>
          <button
            className={`wallet-button ${walletLabel ? 'wallet-button--connected' : ''}`}
            onClick={openWalletChooser}
            aria-label={walletLabel ? `Wallet connected: ${walletLabel}` : 'Connect wallet'}
          >
            <WalletCards size={16} />
            <span>{walletLabel || 'Connect wallet'}</span>
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <nav aria-label="Primary navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={section === item.id ? 'nav-item nav-item--active' : 'nav-item'}
                onClick={() => setSection(item.id)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.id === 'invoices' && actionableCount > 0 && <b>{actionableCount}</b>}
              </button>
            ))}
          </nav>
          <div className="workspace-identity">
            <span className="eyebrow">Workspace</span>
            <strong>{role === 'viewer' ? 'Public registry' : role === 'lender' ? 'Greenline Capital' : role === 'buyer' ? 'Juniper Works' : 'Northstar Supply'}</strong>
            <code>{role === 'viewer' ? 'PUBLIC-PREPROD' : `DEMO-${role.toUpperCase()}-04`}</code>
          </div>
          <button
            type="button"
            className="nav-item"
            style={{ marginTop: 'auto', borderTop: '1px solid var(--line, rgba(0,0,0,0.08))', paddingTop: '10px' }}
            onClick={handleResetData}
            title="Reset demo data to initial state"
          >
            <RotateCcw size={16} />
            <span>Reset Demo State</span>
          </button>
        </aside>

        <main className="main-content" id="main-content">
          <div className="page-header">
            <div>
              <p className="eyebrow">{pageCopy.eyebrow} / {activeLabel}</p>
              <h1>{pageCopy.heading}</h1>
              <p>{pageCopy.body}</p>
            </div>
            {role === 'supplier' && (
              <button className="button button--primary" onClick={() => setRegisterOpen(true)}>
                <Plus size={17} />
                Register invoice
              </button>
            )}
          </div>

          <PriorityBand
            role={role}
            acceptedCount={acceptedCount}
            pendingCount={pendingCount}
            actionableCount={actionableCount}
            onSelect={(status) => {
              const found = invoices.find((invoice) => invoice.status === status);
              if (found) setSelectedInvoiceId(found.id);
              setSection('invoices');
            }}
          />

          <section className="work-grid">
            <InvoiceQueue
              role={role}
              invoices={visibleInvoices}
              selectedId={selectedInvoice?.id ?? ''}
              onSelect={setSelectedInvoiceId}
              onAction={(invoice) => requestFinancing(invoice)}
              busy={busy}
            />
            <EvidencePanel
              invoice={selectedInvoice}
              role={role}
              onBuyerDecision={buyerDecision}
              onLenderDecision={lenderDecision}
              onMarkPaid={markPaid}
              onCopy={() => {
                if (selectedInvoice) void navigator.clipboard?.writeText(selectedInvoice.commitment);
                notify('Public commitment copied.');
              }}
            />
          </section>

          {section === 'policies' ? (
            <PoliciesSection selectedInvoice={selectedInvoice} onCheck={(policyId) => selectedInvoice && requestFinancing(selectedInvoice, policyId)} />
          ) : section === 'requests' ? (
            <RequestsSection invoices={invoices} onSelect={(invoice) => { setSelectedInvoiceId(invoice.id); setRole('lender'); }} />
          ) : section === 'explorer' ? (
            <ExplorerSection invoices={invoices} />
          ) : section === 'demo' ? (
            <DemoGuide />
          ) : (
            <PoliciesSection selectedInvoice={selectedInvoice} compact onCheck={(policyId) => selectedInvoice && requestFinancing(selectedInvoice, policyId)} />
          )}

          <section className="activity-panel">
            <header>
              <div>
                <h2>Recent lifecycle activity</h2>
                <p>Authentic on-chain transactions and state transitions.</p>
              </div>
              <Radio size={17} />
            </header>
            <div>
              {activity.slice(0, 4).map((item) => (
                <article key={item.id}>
                  <span className="activity-marker" />
                  <div>
                    <strong>{item.invoiceAlias}</strong>
                    <p>{item.message}</p>
                    {item.txHash && (
                      <code style={{ fontSize: '11px', display: 'block', color: 'var(--muted, #66706a)' }}>
                        Tx: {formatHash(item.txHash, 6)} {item.blockHeight ? `· Block #${item.blockHeight}` : ''}
                      </code>
                    )}
                  </div>
                  <time>{item.timestamp}</time>
                </article>
              ))}
            </div>
          </section>

          <div className="testnet-notice">
            <FlaskConical size={17} />
            <p>
              <strong>Preprod · Synthetic data only.</strong> ProofFactor demonstrates verification and lifecycle state transitions on the Midnight Network without exposing private commercial secrets.
            </p>
          </div>
        </main>
      </div>

      <RegisterInvoiceDialog open={registerOpen} onClose={() => setRegisterOpen(false)} onSubmit={registerInvoice} />
      <WalletDialog open={walletOpen} wallets={wallets} onClose={() => setWalletOpen(false)} onSelect={chooseWallet} />
      <TransactionDrawer
        open={drawerOpen}
        invoice={activeTxInvoice || selectedInvoice}
        stages={stages}
        actionTitle={drawerTitle}
        onClose={() => !busy && setDrawerOpen(false)}
      />
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

function PriorityBand({
  role,
  acceptedCount,
  pendingCount,
  actionableCount,
  onSelect,
}: {
  role: Role;
  acceptedCount: number;
  pendingCount: number;
  actionableCount: number;
  onSelect: (status: Invoice['status']) => void;
}) {
  return (
    <section className="priority-band">
      <div>
        <span className="priority-dot" />
        <div>
          <h2>{actionableCount} {actionableCount === 1 ? 'invoice needs' : 'invoices need'} action</h2>
          <p>
            {role === 'supplier'
              ? 'Start with an accepted invoice ready for a private policy check.'
              : role === 'buyer'
              ? 'Review proposed commitments before suppliers can request financing.'
              : role === 'lender'
              ? 'Confirm or decline requests currently locked to your policy.'
              : 'Public records expose lifecycle integrity—not invoice contents.'}
          </p>
        </div>
      </div>
      <button onClick={() => onSelect('ACCEPTED')}>
        <span className="eyebrow">Accepted</span>
        <strong><span className="dot dot--success" />{acceptedCount} ready</strong>
      </button>
      <button onClick={() => onSelect('PENDING_FINANCING')}>
        <span className="eyebrow">Pending financing</span>
        <strong><span className="dot dot--pending" />{pendingCount} awaiting lender</strong>
      </button>
    </section>
  );
}

function InvoiceQueue({
  role,
  invoices,
  selectedId,
  onSelect,
  onAction,
  busy,
}: {
  role: Role;
  invoices: Invoice[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAction: (invoice: Invoice) => void;
  busy: boolean;
}) {
  return (
    <section className="panel invoice-queue">
      <header className="panel__header">
        <div>
          <h2>{role === 'lender' ? 'Financing requests' : role === 'buyer' ? 'Buyer review queue' : 'Recent invoices'}</h2>
          <p>Decision queue · private values excluded</p>
        </div>
        <span className="eyebrow">{invoices.length} records</span>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice alias</th>
              <th>Counterparty</th>
              <th>Lifecycle</th>
              <th>Due window</th>
              <th>Tx Hash</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                className={selectedId === invoice.id ? 'selected' : ''}
                onClick={() => onSelect(invoice.id)}
                tabIndex={0}
                onKeyDown={(event) => { if (event.key === 'Enter') onSelect(invoice.id); }}
              >
                <td>
                  <strong>{invoice.alias}</strong>
                  <code>{formatHash(invoice.commitment, 4)}</code>
                </td>
                <td>{role === 'buyer' ? invoice.supplierAlias : invoice.buyerAlias}</td>
                <td><StatusBadge status={invoice.status} /></td>
                <td><code>{invoice.dueWindow}</code></td>
                <td>
                  <code style={{ fontSize: '11px' }}>{formatHash(invoice.txHash, 4)}</code>
                </td>
                <td>
                  {role === 'supplier' && invoice.status === 'ACCEPTED' ? (
                    <button
                      disabled={busy}
                      className="button button--small button--secondary"
                      onClick={(event) => { event.stopPropagation(); onAction(invoice); }}
                    >
                      Check privately
                    </button>
                  ) : (
                    <span className="muted">
                      {invoice.status === 'PENDING_FINANCING'
                        ? 'Await lender'
                        : invoice.status === 'PROPOSED'
                        ? 'Await buyer'
                        : 'Open details'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {invoices.length === 0 && (
        <div className="empty-state">
          <strong>No records for this role.</strong>
          <p>Switch roles or create a new synthetic invoice.</p>
        </div>
      )}
    </section>
  );
}

function EvidencePanel({
  invoice,
  role,
  onBuyerDecision,
  onLenderDecision,
  onMarkPaid,
  onCopy,
}: {
  invoice: Invoice | null;
  role: Role;
  onBuyerDecision: (accepted: boolean) => void;
  onLenderDecision: (confirmed: boolean) => void;
  onMarkPaid: () => void;
  onCopy: () => void;
}) {
  if (!invoice) return <aside className="panel evidence-panel empty-state">Select an invoice to inspect its public evidence.</aside>;
  const lifecycle = ['PROPOSED', 'ACCEPTED', 'PENDING_FINANCING', 'FINANCED_CONFIRMED', 'PAID'] as const;
  const activeIndex = Math.max(0, lifecycle.indexOf(invoice.status as (typeof lifecycle)[number]));

  return (
    <aside className="panel evidence-panel">
      <header className="panel__header">
        <div>
          <h2>{invoice.alias} evidence</h2>
          <p>Selected invoice</p>
        </div>
        {invoice.proofVerified ? <PrivacyTag level="PROVED, NOT SHARED" /> : <PrivacyTag level="LOCAL ONLY" />}
      </header>
      <div className="evidence-panel__body">
        <ol className="lifecycle" aria-label="Invoice lifecycle">
          {lifecycle.map((status, index) => (
            <li key={status} className={index <= activeIndex ? 'complete' : ''}>
              <span />
              <small>{status.replace('_', ' ')}</small>
            </li>
          ))}
        </ol>
        <div className="evidence-rows">
          <div>
            <span>Buyer acknowledged invoice</span>
            <strong>
              <BadgeCheck size={15} />
              {['ACCEPTED', 'PENDING_FINANCING', 'FINANCED_CONFIRMED', 'PAID'].includes(invoice.status) ? 'Verified' : 'Pending'}
            </strong>
          </div>
          <div>
            <span>Canonical data matches commitment</span>
            <strong>{invoice.proofVerified ? 'Proved privately' : 'Not proved yet'}</strong>
          </div>
          <div>
            <span>Exact invoice amount</span>
            <strong className="muted">Not disclosed</strong>
          </div>
          <div>
            <span>Stable nullifier</span>
            <strong>{invoice.nullifier ? 'Bound on-chain' : 'Not issued'}</strong>
          </div>
          {invoice.txHash && (
            <div>
              <span>Latest Tx Hash</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <code style={{ fontSize: '11px' }}>{formatHash(invoice.txHash, 5)}</code>
                <a href={getExplorerUrl(invoice.txHash)} target="_blank" rel="noreferrer" title="Explorer">
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </div>
        <div className="public-metadata">
          <div>
            <span className="eyebrow">Public commitment (32-byte hash)</span>
            <PrivacyTag level="PUBLIC ON-CHAIN" />
          </div>
          <div>
            <code>{formatHash(invoice.commitment, 8)}</code>
            <button className="icon-button" onClick={onCopy} aria-label="Copy public commitment">
              <Copy size={15} />
            </button>
          </div>
        </div>
        <p className="disclosure-note">
          <strong>Disclosure boundary:</strong> Workspace aliases are local labels. Public state contains a 32-byte commitment, stable nullifier, and lifecycle state—not private invoice numbers or commercial margins.
        </p>
        <div className="evidence-actions">
          {role === 'buyer' && invoice.status === 'PROPOSED' && (
            <>
              <button className="button button--secondary button--danger" onClick={() => onBuyerDecision(false)}>
                Reject
              </button>
              <button className="button button--primary" onClick={() => onBuyerDecision(true)}>
                Accept invoice
              </button>
            </>
          )}
          {role === 'lender' && invoice.status === 'PENDING_FINANCING' && (
            <>
              <button className="button button--secondary" onClick={() => onLenderDecision(false)}>
                Decline & release
              </button>
              <button className="button button--primary" onClick={() => onLenderDecision(true)}>
                Confirm financing
              </button>
            </>
          )}
          {role === 'buyer' && ['ACCEPTED', 'FINANCED_CONFIRMED'].includes(invoice.status) && (
            <button className="button button--secondary" onClick={onMarkPaid}>
              Mark paid
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function PoliciesSection({
  selectedInvoice,
  compact = false,
  onCheck,
}: {
  selectedInvoice: Invoice | null;
  compact?: boolean;
  onCheck: (policyId: string) => void;
}) {
  return (
    <section className={`panel policies-panel ${compact ? 'policies-panel--compact' : ''}`}>
      <header className="panel__header">
        <div>
          <h2>Available lender policies</h2>
          <p>Public terms; eligibility is checked against private invoice facts.</p>
        </div>
        <span className="eyebrow">{demoPolicies.filter((policy) => policy.active).length} active</span>
      </header>
      <div className="policy-grid">
        {demoPolicies.slice(0, compact ? 2 : 3).map((policy) => (
          <article key={policy.id}>
            <div className="policy-icon">
              <Building2 size={18} />
            </div>
            <div>
              <h3>{policy.lenderAlias}</h3>
              <p><code>{policy.currency}</code> · public range · up to {policy.maxRemainingDays} days</p>
            </div>
            <button
              className="button button--small button--secondary"
              disabled={!selectedInvoice || selectedInvoice.status !== 'ACCEPTED'}
              onClick={() => onCheck(policy.id)}
            >
              Check privately
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function RequestsSection({ invoices, onSelect }: { invoices: Invoice[]; onSelect: (invoice: Invoice) => void }) {
  const requests = invoices.filter((invoice) => ['PENDING_FINANCING', 'FINANCED_CONFIRMED'].includes(invoice.status));
  return (
    <section className="panel cards-section">
      <header className="panel__header">
        <div>
          <h2>Financing request queue</h2>
          <p>Requests show proof results and public lifecycle state—not invoice documents.</p>
        </div>
        <CircleDollarSign size={18} />
      </header>
      <div className="cards-grid">
        {requests.map((invoice) => (
          <button key={invoice.id} onClick={() => onSelect(invoice)}>
            <StatusBadge status={invoice.status} />
            <h3>{invoice.alias}</h3>
            <p>Policy {invoice.policyId ?? 'unassigned'} · {invoice.currency}</p>
            <code>{formatHash(invoice.nullifier, 6)}</code>
          </button>
        ))}
      </div>
    </section>
  );
}

function ExplorerSection({ invoices }: { invoices: Invoice[] }) {
  return (
    <section className="panel explorer">
      <header className="panel__header">
        <div>
          <h2>Midnight Preprod public explorer</h2>
          <p>Only intentionally public registry fields and transaction hashes are shown.</p>
        </div>
        <PrivacyTag level="PUBLIC ON-CHAIN" />
      </header>
      <div className="explorer-list">
        {invoices.map((invoice) => (
          <article key={invoice.id}>
            <Radio size={16} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>Commitment: {formatHash(invoice.commitment, 8)}</strong>
                <a
                  href={getExplorerUrl(invoice.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '11px', color: 'var(--forest, #173b2c)' }}
                  title="View transaction on Midnight Preprod explorer"
                >
                  <ExternalLink size={11} /> Tx
                </a>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--muted, #66706a)' }}>
                Block #{invoice.blockHeight} · Gas: {invoice.dustFee} DUST · Fee: {invoice.nightFee} NIGHT
              </span>
            </div>
            <StatusBadge status={invoice.status} />
            <code>{invoice.nullifier ? `Nullifier: ${formatHash(invoice.nullifier, 6)}` : 'Nullifier unspent'}</code>
          </article>
        ))}
      </div>
    </section>
  );
}

function DemoGuide() {
  return (
    <section className="panel demo-guide">
      <header className="panel__header">
        <div>
          <h2>Four-stage privacy demo path</h2>
          <p>Demonstrate the complete privacy-preserving lifecycle with zero-knowledge proofs.</p>
        </div>
        <FlaskConical size={18} />
      </header>
      <ol>
        <li>
          <span>01</span>
          <div>
            <strong>Supplier registers</strong>
            <p>Create a local invoice opening and publish a 32-byte cryptographic commitment to the Midnight ledger.</p>
          </div>
        </li>
        <li>
          <span>02</span>
          <div>
            <strong>Buyer acknowledges</strong>
            <p>Verify the invoice against purchase orders locally, then issue an authenticated acceptance and stable nullifier.</p>
          </div>
        </li>
        <li>
          <span>03</span>
          <div>
            <strong>Supplier proves eligibility</strong>
            <p>Generate a zero-knowledge proof satisfying lender policy constraints without revealing commercial details.</p>
          </div>
        </li>
        <li>
          <span>04</span>
          <div>
            <strong>Lender confirms</strong>
            <p>Verify proof validity on-chain, confirm the financing lock, and permanently consume the nullifier to prevent double-financing.</p>
          </div>
        </li>
      </ol>
    </section>
  );
}
