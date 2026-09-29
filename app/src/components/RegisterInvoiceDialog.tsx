import { FormEvent, useEffect, useState } from 'react';
import { EyeOff, X } from 'lucide-react';
import type { NewInvoiceInput } from '../domain/types';
import { PrivacyTag } from './PrivacyTag';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewInvoiceInput) => void;
}

const initialForm: NewInvoiceInput = {
  alias: '',
  buyerAlias: '',
  amount: '',
  currency: 'USD',
  dueDate: '',
};

export function RegisterInvoiceDialog({ open, onClose, onSubmit }: Props) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const today = new Date().toISOString().split('T')[0];

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(form.amount);
    if (!form.alias.trim() || !form.buyerAlias.trim() || !form.dueDate || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Complete every field and enter a valid amount greater than zero.');
      return;
    }
    onSubmit(form);
    setForm(initialForm);
    setError('');
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="register-title">
        <header className="dialog__header">
          <div>
            <p className="eyebrow">Supplier action / local preparation</p>
            <h2 id="register-title">Register invoice commitment</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close registration form">
            <X />
          </button>
        </header>
        <form onSubmit={submit} className="dialog__body">
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="privacy-callout">
            <EyeOff size={18} aria-hidden="true" />
            <div>
              <strong>Private fields stay local in this demo.</strong>
              <p>The contract receives a commitment, not these invoice values.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field field--wide">
              Invoice alias
              <span>Use a safe internal label—not the invoice number.</span>
              <input
                value={form.alias}
                onChange={(event) => setForm({ ...form, alias: event.target.value })}
                placeholder="e.g. Delta-31"
                autoFocus
              />
            </label>
            <label className="field field--wide">
              Buyer workspace alias
              <span>A demo-safe label for the counterparty.</span>
              <input
                value={form.buyerAlias}
                onChange={(event) => setForm({ ...form, buyerAlias: event.target.value })}
                placeholder="e.g. Elm Trading"
              />
            </label>
            <label className="field">
              Amount
              <span>Never shown in the public explorer.</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                placeholder="25000.00"
              />
            </label>
            <label className="field">
              Currency
              <span>Bound into the commitment.</span>
              <select
                value={form.currency}
                onChange={(event) => setForm({ ...form, currency: event.target.value as NewInvoiceInput['currency'] })}
              >
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
              </select>
            </label>
            <label className="field field--wide">
              Due date
              <span>Used privately for policy eligibility.</span>
              <input
                type="date"
                min={today}
                value={form.dueDate}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
              />
            </label>
          </div>
          <div className="disclosure-preview">
            <div>
              <PrivacyTag level="LOCAL ONLY" />
              <span>Amount, dates, buyer alias and canonical invoice fields</span>
            </div>
            <div>
              <PrivacyTag level="PUBLIC ON-CHAIN" />
              <span>Commitment, lifecycle state and routing metadata</span>
            </div>
          </div>
          <footer className="dialog__footer">
            <button
              type="button"
              className="button button--secondary"
              onClick={() =>
                setForm({
                  alias: 'Apex-42',
                  buyerAlias: 'Meridian Works',
                  amount: '350000.00',
                  currency: 'USD',
                  dueDate: '2026-11-30',
                })
              }
            >
              Fill sample
            </button>
            <button type="button" className="button button--secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button button--primary" type="submit">
              Create commitment
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

