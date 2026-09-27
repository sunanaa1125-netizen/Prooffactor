/**
 * Local state persistence for ProofFactor.
 * Ensures user-created invoices, state transitions, and audit activity persist across reloads.
 */

import { Invoice, ActivityItem } from './types';
import { demoInvoices, initialActivity } from './demo-data';

const INVOICES_KEY = 'prooffactor.invoices.v1';
const ACTIVITY_KEY = 'prooffactor.activity.v1';

export function loadStoredInvoices(): Invoice[] {
  if (typeof window === 'undefined') return demoInvoices;
  try {
    const raw = window.localStorage.getItem(INVOICES_KEY);
    if (!raw) return demoInvoices;
    const parsed = JSON.parse(raw) as Invoice[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to load stored invoices from localStorage', err);
  }
  return demoInvoices;
}

export function saveStoredInvoices(invoices: Invoice[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
  } catch (err) {
    console.warn('Failed to save invoices to localStorage', err);
  }
}

export function loadStoredActivity(): ActivityItem[] {
  if (typeof window === 'undefined') return initialActivity;
  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return initialActivity;
    const parsed = JSON.parse(raw) as ActivityItem[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to load stored activity from localStorage', err);
  }
  return initialActivity;
}

export function saveStoredActivity(activity: ActivityItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity));
  } catch (err) {
    console.warn('Failed to save activity to localStorage', err);
  }
}

export function resetStoredData(): { invoices: Invoice[]; activity: ActivityItem[] } {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(INVOICES_KEY);
    window.localStorage.removeItem(ACTIVITY_KEY);
  }
  return { invoices: demoInvoices, activity: initialActivity };
}
