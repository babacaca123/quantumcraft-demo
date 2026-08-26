import type { Attachment, PhaseWithDetail, SubWithDetail, TaskWithDetail } from "@/lib/types";

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
 * Change orders stack on top of a sub's main order until the sub is paid off;
 * see subCost for why they stop stacking at that point.
 *
 * Multiple confirmed receipts on one record sum rather than fight — a sub paid
 * in two checks is the common case.
 *
 * All of this happens here, at display time, and nowhere else. `paid_amount` and
 * `price` hold what the user typed and are never written to by receipt activity,
 * so unconfirming or deleting a receipt simply drops out of the sum below and
 * the hand-entered figure is still there underneath it.
 */

/**
 * What the confirmed receipts on one record add up to, or null if there are
 * none. Computed from the rows every time rather than stored, so it always
 * reflects the receipts as they stand right now.
 */
export function confirmedReceiptTotal(attachments: Attachment[]): number | null {
  const confirmed = attachments.filter((a) => a.is_confirmed && a.amount != null);
  if (confirmed.length === 0) return null;
  return confirmed.reduce((sum, a) => sum + Number(a.amount), 0);
}

export interface CostBreakdown {
  /** What actually counts toward the total. */
  effective: number;
  /** The hand-entered figure, still on record and still exactly as it was typed. */
  manual: number;
  /** Set when confirmed receipts replaced the manual figure. */
  receiptOverride: number | null;
  /**
   * Receipts are counting *and* they disagree with what was entered by hand —
   * the only case where showing the user both figures tells them anything.
   */
  disagrees: boolean;
}

/** Cents, so a float's last bit never reads as a disagreement. */
function differ(a: number, b: number): boolean {
  return Math.round(a * 100) !== Math.round(b * 100);
}

export interface SubCostBreakdown extends CostBreakdown {
  /** The original bid — the "main order" a change order sits on top of. */
  bid: number;
  /** Every change order on this sub, summed. */
  changeOrders: number;
  /** Change orders raised after the sub was paid off and ticked as paid since. */
  paidChangeOrders: number;
  /** True while the figure is still bid + change orders rather than what was paid. */
  isProjected: boolean;
}

/**
 * A sub costs:
 *
 *   before it is paid   bid + every change order            (a projection)
 *   once it is paid     the paid amount + change orders
 *                       raised since and ticked as paid     (the actual)
 *
 * Change orders stack on top of the main order, which is the point of them.
 * But the amount entered when checking a sub off is what was *actually handed
 * over* for the whole job — main order and change orders together — so adding
 * the change orders it already covers on top of it would bill them twice.
 *
 * Extra scope raised after that settlement is genuinely extra, so ticking it
 * paid adds it on top. Re-entering the paid amount clears those ticks, because
 * the new figure is all-in again (see completeSub).
 */
export function subCost(sub: SubWithDetail): SubCostBreakdown {
  const bid = Number(sub.bid_price ?? 0);
  const changeOrders = sub.change_orders.reduce((sum, co) => sum + Number(co.amount ?? 0), 0);
  const paidChangeOrders = sub.change_orders
    .filter((co) => co.is_paid)
    .reduce((sum, co) => sum + Number(co.amount ?? 0), 0);
  const paid = sub.paid_amount == null ? null : Number(sub.paid_amount);

  const manual = paid == null ? bid + changeOrders : paid + paidChangeOrders;
  const receiptOverride = confirmedReceiptTotal(sub.attachments);

  const effective = receiptOverride == null ? manual : receiptOverride + paidChangeOrders;

  return {
    effective,
    manual,
    receiptOverride,
    disagrees: receiptOverride != null && differ(effective, manual),
    bid,
    changeOrders,
    paidChangeOrders,
    isProjected: paid == null,
  };
}

/** A task costs its price (or receipt override). Priced-at-nothing tasks never count. */
export function taskCost(task: TaskWithDetail): CostBreakdown {
  const manual = Number(task.price ?? 0);
  const receiptOverride = confirmedReceiptTotal(task.attachments);

  const effective = receiptOverride ?? manual;

  return {
    effective,
    manual,
    receiptOverride,
    disagrees: receiptOverride != null && differ(effective, manual),
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
  const bid = phase.subcontractors.reduce(
    (sum, s) => sum + subCost(s).bid + subCost(s).changeOrders,
    0,
  );

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
