import type {
  Attachment,
  PhaseWithDetail,
  SubWithDetail,
  TaskWithDetail,
} from "@/lib/types";

/**
 * Spec §5, the one rule the whole tracker turns on:
 *
 *   The manually-entered number is the default source of truth.
 *   A confirmed receipt is an override, not a gate.
 *
 * So a sub's paid amount and a task's price count the moment they are typed in,
 * with no receipt required — checks mailed to subs rarely get photographed. If
 * confirmed receipts later show up on that record, their total replaces the
 * manual figure. Unconfirmed receipts never count: OCR misreads amounts, so the
 * user confirms before anything moves.
 *
 * Multiple confirmed receipts on one record sum rather than fight — a sub paid
 * in two checks is the common case.
 */

function confirmedTotal(attachments: Attachment[]): number | null {
  const confirmed = attachments.filter((a) => a.is_confirmed && a.amount != null);
  if (confirmed.length === 0) return null;
  return confirmed.reduce((sum, a) => sum + Number(a.amount), 0);
}

export interface CostBreakdown {
  /** What actually counts toward the total. */
  effective: number;
  /** The hand-entered figure, kept so the UI can show what was overridden. */
  manual: number;
  /** Set when confirmed receipts replaced the manual figure. */
  receiptOverride: number | null;
}

/** A sub costs its paid amount (or receipt override) plus every change order. */
export function subCost(sub: SubWithDetail): CostBreakdown {
  const manual = Number(sub.paid_amount ?? 0);
  const receiptOverride = confirmedTotal(sub.attachments);
  const changeOrders = sub.change_orders.reduce((sum, co) => sum + Number(co.amount ?? 0), 0);

  return {
    effective: (receiptOverride ?? manual) + changeOrders,
    manual: manual + changeOrders,
    receiptOverride: receiptOverride == null ? null : receiptOverride + changeOrders,
  };
}

/** A task costs its price (or receipt override). Priced-at-nothing tasks never count. */
export function taskCost(task: TaskWithDetail): CostBreakdown {
  const manual = Number(task.price ?? 0);
  const receiptOverride = confirmedTotal(task.attachments);

  return {
    effective: receiptOverride ?? manual,
    manual,
    receiptOverride,
  };
}

export interface PhaseTotals {
  subs: number;
  tasks: number;
  total: number;
  /** Bid prices on record for this phase — shown alongside actuals, never counted. */
  bid: number;
}

export function phaseTotals(phase: PhaseWithDetail): PhaseTotals {
  const subs = phase.subcontractors.reduce((sum, s) => sum + subCost(s).effective, 0);
  const tasks = phase.tasks.reduce((sum, t) => sum + taskCost(t).effective, 0);
  const bid = phase.subcontractors.reduce((sum, s) => sum + Number(s.bid_price ?? 0), 0);

  return { subs, tasks, total: subs + tasks, bid };
}

export function projectTotal(phases: PhaseWithDetail[]): number {
  return phases.reduce((sum, phase) => sum + phaseTotals(phase).total, 0);
}

// ---------------------------------------------------------------- formatting

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function money(value: number | null | undefined): string {
  return currency.format(Number(value ?? 0));
}

/** Currency, but blank rather than "$0.00" when nothing has been entered. */
export function moneyOrDash(value: number | null | undefined): string {
  return value == null ? "—" : money(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  // Date columns come back as YYYY-MM-DD; parse as local so the day doesn't slip.
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
