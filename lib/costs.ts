import type { Attachment, PhaseWithDetail, SubWithDetail, TaskWithDetail } from "@/lib/types";

/**
 * Spec §5, the one rule the whole tracker turns on:
 *
 *   The manually-entered number is the default source of truth.
 *   A confirmed receipt is an override, not a gate.
 *
 * So the figure entered on settling a sub, and the price on a task once it is
 * ticked off, count the moment they are typed in, with no receipt required —
 * checks mailed to subs rarely get photographed. If
 * confirmed receipts later show up on that record, their total replaces the
 * manual figure outright — on a sub that means the bid, the change orders and
 * the paid amount all at once, because a receipt is money that actually left the
 * account and the rest is bookkeeping. Unconfirmed receipts never count: OCR
 * misreads amounts, so the user confirms before anything moves.
 *
 * Every record costs two numbers, and they are not the same question:
 *
 *   actual      money that has gone out. Receipts, and the figure entered on
 *               settling a sub or finishing a task. Nothing else — an open sub
 *               with a bid on it has cost nothing yet.
 *   projected   what it is heading for: the actual where that is known, the bid
 *               or the price until then.
 *
 * They meet once everything is settled. Until then the gap between them is the
 * work still to pay for, which is the number a build actually runs on — so both
 * are carried the whole way up, phase by phase, rather than one being folded
 * into the other and argued about later.
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

/** The same cost asked two ways. See the note above. */
export interface Split {
  actual: number;
  projected: number;
}

export interface CostBreakdown {
  /** Money out on this record. Zero until something settles it. */
  actual: number;
  /** Where it is heading: the actual where known, the estimate until then. */
  projected: number;
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

/** Two decimal places, the only precision any of these figures actually has. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
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
  /** Change orders the paid amount does not cover — scope it was entered before. */
  uncoveredChangeOrders: number;
  /**
   * What an all-in figure entered right now would have to come to: what is
   * already paid, plus every change order that figure does not yet cover. The
   * number the complete dialog offers, so re-entering a paid amount folds in
   * scope raised since rather than showing the old figure back.
   */
  allIn: number;
  /** True while the figure is still bid + change orders rather than what was paid. */
  isProjected: boolean;
  /** Receipts minus what was entered by hand. Signed, and 0 when none count. */
  gap: number;
  /** That gap is real and has not already been waved through. */
  warn: boolean;
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
 * Which is why settling a sub marks every change order on it covered: covered
 * scope is inside the paid figure and adds nothing further, and the row says so
 * instead of offering a tick that would bill it a second time.
 *
 * Extra scope raised after that settlement is genuinely extra, so ticking it
 * paid adds it on top. Re-entering the paid amount covers everything again and
 * clears those ticks, because the new figure is all-in as of then (see
 * completeSub).
 */
export function subCost(sub: SubWithDetail): SubCostBreakdown {
  const bid = Number(sub.bid_price ?? 0);
  const changeOrders = sub.change_orders.reduce((sum, co) => sum + Number(co.amount ?? 0), 0);
  // Covered is checked as well as ticked, so no combination of the two flags can
  // put a change order into the total twice.
  const paidChangeOrders = sub.change_orders
    .filter((co) => co.is_paid && !co.is_covered)
    .reduce((sum, co) => sum + Number(co.amount ?? 0), 0);
  const paid = sub.paid_amount == null ? null : Number(sub.paid_amount);

  const uncoveredChangeOrders = sub.change_orders
    .filter((co) => !co.is_covered)
    .reduce((sum, co) => sum + Number(co.amount ?? 0), 0);

  const settled = paid == null ? null : paid + paidChangeOrders;
  const manual = settled ?? bid + changeOrders;
  // Unpaid, nothing is covered and this is the projection again; paid off, it is
  // that figure plus whatever scope has been raised since.
  const allIn = (paid ?? bid) + uncoveredChangeOrders;
  const receiptOverride = confirmedReceiptTotal(sub.attachments);

  // Receipts win outright, for both questions. Not the bid, not the paid amount,
  // and nothing added on top for change orders: what the receipts come to is
  // what the sub cost.
  //
  // Failing receipts, a settled sub has cost what was entered on settling it,
  // and an open one has cost nothing at all — its bid is a plan, not a payment.
  const actual = receiptOverride ?? settled ?? 0;
  const projected = receiptOverride ?? manual;
  const gap = receiptOverride == null ? 0 : round2(projected - manual);

  return {
    actual,
    projected,
    manual,
    receiptOverride,
    disagrees: receiptOverride != null && differ(projected, manual),
    bid,
    changeOrders,
    paidChangeOrders,
    uncoveredChangeOrders,
    allIn,
    isProjected: paid == null,
    gap,
    // Dismissing records the gap, not the shrug — so moving either figure moves
    // the gap and the warning is back, which is the whole point of it.
    warn:
      gap !== 0 &&
      (sub.acknowledged_gap == null || differ(Number(sub.acknowledged_gap), gap)),
  };
}

/**
 * A task costs its price, or its receipts. Priced-at-nothing tasks never count.
 *
 * An unticked task has cost nothing yet for the same reason an open sub has:
 * "call Bob about the slab pour, $500" is money owed, not money gone.
 */
export function taskCost(task: TaskWithDetail): CostBreakdown {
  const manual = Number(task.price ?? 0);
  const receiptOverride = confirmedReceiptTotal(task.attachments);

  const actual = receiptOverride ?? (task.is_complete ? manual : 0);
  const projected = receiptOverride ?? manual;

  return {
    actual,
    projected,
    manual,
    receiptOverride,
    disagrees: receiptOverride != null && differ(projected, manual),
  };
}

export interface PhaseTotals {
  subs: Split;
  tasks: Split;
  total: Split;
  /** Bid prices on record for this phase — shown alongside the figures, never counted. */
  bid: number;
}

function add(parts: CostBreakdown[]): Split {
  return {
    actual: parts.reduce((sum, p) => sum + p.actual, 0),
    projected: parts.reduce((sum, p) => sum + p.projected, 0),
  };
}

export function phaseTotals(phase: PhaseWithDetail): PhaseTotals {
  const subs = add(phase.subcontractors.map(subCost));
  const tasks = add(phase.tasks.map(taskCost));
  const bid = phase.subcontractors.reduce(
    (sum, s) => sum + subCost(s).bid + subCost(s).changeOrders,
    0,
  );

  return {
    subs,
    tasks,
    total: {
      actual: subs.actual + tasks.actual,
      projected: subs.projected + tasks.projected,
    },
    bid,
  };
}

export function projectTotal(phases: PhaseWithDetail[]): Split {
  const totals = phases.map(phaseTotals);
  return {
    actual: totals.reduce((sum, t) => sum + t.total.actual, 0),
    projected: totals.reduce((sum, t) => sum + t.total.projected, 0),
  };
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
