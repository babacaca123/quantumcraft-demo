"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  acknowledgeCostGap,
  createChangeOrder,
  createSub,
  deleteChangeOrder,
  deleteSub,
  setChangeOrderPaid,
  toggleSubFavorite,
  uncompleteSub,
  updateSub,
} from "@/app/actions/tracker";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
import {
  DeleteButton,
  ErrorNote,
  Modal,
  SubmitButton,
  useAction,
  useCloseOnSuccess,
} from "@/components/ui";
import { CompleteSubDialog } from "@/components/subs/complete-sub-dialog";
import { money, moneyOrDash, subCost } from "@/lib/costs";
import type { SubCostBreakdown } from "@/lib/costs";
import type { ActionResult, ChangeOrder, SubWithDetail } from "@/lib/types";

export function SubSection({
  phaseId,
  subs,
  signedUrls,
}: {
  phaseId: string;
  subs: SubWithDetail[];
  signedUrls: Record<string, string>;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="block">
      <div className="section-head row spread wrapped gap-16">
        <h2>Subcontractors</h2>
        <button
          type="button"
          className="iconbtn"
          aria-label="Add subcontractor"
          onClick={() => setAdding(true)}
        >
          +
        </button>
      </div>

      {subs.length === 0 ? (
        <div className="empty">No subcontractors on this phase yet.</div>
      ) : (
        subs.map((sub) => (
          <SubRow key={sub.id} sub={sub} phaseId={phaseId} signedUrls={signedUrls} />
        ))
      )}

      <SubDialog phaseId={phaseId} open={adding} onClose={() => setAdding(false)} />
    </section>
  );
}

function SubRow({
  sub,
  phaseId,
  signedUrls,
}: {
  sub: SubWithDetail;
  phaseId: string;
  signedUrls: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [addingChangeOrder, setAddingChangeOrder] = useState(false);
  const [queryingGap, setQueryingGap] = useState(false);
  const { run, pending, error } = useAction();

  const cost = subCost(sub);
  const overridden = cost.receiptOverride != null;

  return (
    <div className="item">
      <input
        type="checkbox"
        checked={sub.is_complete}
        disabled={pending}
        aria-label={`Mark ${sub.name} complete`}
        onChange={(e) => {
          // Checking asks what was actually paid; unchecking clears it (spec §3).
          if (e.target.checked) setCompleting(true);
          else run(() => uncompleteSub(sub.id));
        }}
      />

      <div style={{ minWidth: 0 }}>
        <div className="row gap-8 wrapped">
          <span className={`item-name ${sub.is_complete ? "strike" : ""}`}>{sub.name}</span>
          {sub.is_favorite ? <span className="badge fav">pinned</span> : null}
          <button
            type="button"
            className={`iconbtn bare star ${sub.is_favorite ? "on" : ""}`}
            aria-label={sub.is_favorite ? "Unfavorite in this phase" : "Favorite in this phase"}
            title="Favorite — this phase only"
            disabled={pending}
            onClick={() => run(() => toggleSubFavorite(sub.id, !sub.is_favorite))}
          >
            {sub.is_favorite ? "★" : "☆"}
          </button>
        </div>

        <div className="item-meta">
          {sub.company ? <span>{sub.company}</span> : null}
          {sub.phone ? <span>{sub.phone}</span> : null}
          <span>bid {moneyOrDash(sub.bid_price)}</span>
          {cost.changeOrders > 0 ? <span>+{money(cost.changeOrders)} change orders</span> : null}
        </div>

        {sub.change_orders.map((order) => (
          <ChangeOrderRow
            key={order.id}
            order={order}
            subIsPaid={sub.is_complete}
            inReceipts={overridden}
          />
        ))}

        <AttachmentPanel
          phaseId={phaseId}
          subcontractorId={sub.id}
          attachments={sub.attachments}
          signedUrls={signedUrls}
        />

        <div className="row gap-16 wrapped" style={{ marginTop: 10 }}>
          <button type="button" className="linkbtn" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className="linkbtn" onClick={() => setAddingChangeOrder(true)}>
            + Change order
          </button>
          {sub.is_complete ? (
            <button type="button" className="linkbtn" onClick={() => setCompleting(true)}>
              Change paid amount
            </button>
          ) : null}
          <DeleteButton onDelete={() => deleteSub(sub.id)} label="Delete sub" />
        </div>

        {error ? <div className="notice">{error}</div> : null}
      </div>

      <div className="item-amounts">
        <div>{money(cost.projected)}</div>
        {overridden ? (
          <>
            <div className="micro rust">from receipts</div>
            {/* The hand-entered figure is still on record and still exactly as
                it was typed — it just isn't the one counting. Shown only when
                it actually disagrees, so an agreeing receipt stays quiet. */}
            {cost.disagrees && cost.manual > 0 ? (
              <div className="micro superseded">{money(cost.manual)} entered</div>
            ) : null}
            {cost.warn ? (
              <button
                type="button"
                className="gapwarn"
                title="Total paid does not match the projected amount"
                onClick={() => setQueryingGap(true)}
              >
                <WarnIcon />
                doesn&rsquo;t match
              </button>
            ) : null}
          </>
        ) : cost.isProjected ? (
          // bid + change orders, until the actual paid figure replaces both
          <div className="micro">projected</div>
        ) : cost.paidChangeOrders > 0 ? (
          <div className="micro route">paid +{money(cost.paidChangeOrders)} extra</div>
        ) : (
          <div className="micro route">paid</div>
        )}
      </div>

      <SubDialog phaseId={phaseId} sub={sub} open={editing} onClose={() => setEditing(false)} />

      <CompleteSubDialog
        sub={sub}
        open={completing}
        onClose={() => setCompleting(false)}
      />

      <ChangeOrderDialog
        subId={sub.id}
        open={addingChangeOrder}
        onClose={() => setAddingChangeOrder(false)}
      />

      <CostGapDialog
        sub={sub}
        cost={cost}
        open={queryingGap}
        onClose={() => setQueryingGap(false)}
      />
    </div>
  );
}

/**
 * One change order. While the sub is still a projection every change order is
 * already counted through the bid, so there is nothing to tick.
 *
 * Settling the sub crosses them all off: the paid figure is all-in, so each one
 * is inside it and adds nothing further. Only scope raised *after* that figure
 * was entered is genuinely on top, and that is the one row left with a box —
 * which is what keeps a covered change order from being billed twice.
 *
 * Confirmed receipts cross them all off the same way and for the same reason:
 * the receipt total is the whole sub, this change order included. A box there
 * would move nothing, so there is not one.
 */
function ChangeOrderRow({
  order,
  subIsPaid,
  inReceipts,
}: {
  order: ChangeOrder;
  subIsPaid: boolean;
  inReceipts: boolean;
}) {
  const { run, pending, error } = useAction();
  const covered = inReceipts || (subIsPaid && order.is_covered);

  return (
    <>
      <div className="subrow">
        {subIsPaid ? (
          <input
            type="checkbox"
            checked={covered || order.is_paid}
            // Nothing to decide on a covered one: it is in the total already,
            // and there is no second time to add it.
            disabled={pending || covered}
            aria-label={
              covered
                ? `${order.description} is already in the total`
                : `Add ${order.description} to the paid total`
            }
            title={
              inReceipts
                ? "Covered by the receipt total"
                : covered
                  ? "Covered by the paid amount"
                  : "Paid on top of the settled amount"
            }
            onChange={(e) => run(() => setChangeOrderPaid(order.id, e.target.checked))}
          />
        ) : null}

        <span className="subrow-label">change order</span>
        <span className={`subrow-desc ${covered ? "strike" : ""}`}>{order.description}</span>

        <span className="amt">{money(order.amount)}</span>
        {covered ? (
          <span className="subrow-note route">
            {inReceipts ? "in the receipt total" : "in the paid amount"}
          </span>
        ) : null}
        {subIsPaid && !covered && !order.is_paid ? (
          <span className="subrow-note rust">not in total</span>
        ) : null}

        <DeleteButton onDelete={() => deleteChangeOrder(order.id)} label="Remove" />
      </div>
      {error ? <div className="notice">{error}</div> : null}
    </>
  );
}

/** The one symbol on the row that means these two numbers disagree. */
function WarnIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 1.9 15 14.2H1Z" />
      <path d="M8 6.2v3.5" />
      <path d="M8 11.9h0.01" />
    </svg>
  );
}

/**
 * What the warning is for, and the only thing to do about it.
 *
 * Receipts are the total either way — dismissing changes no figure, it records
 * that this particular disagreement has been looked at. Which is why it records
 * the gap rather than the shrug: move either number afterwards and the warning
 * is back, because that is a different disagreement and nobody has seen it.
 */
function CostGapDialog({
  sub,
  cost,
  open,
  onClose,
}: {
  sub: SubWithDetail;
  cost: SubCostBreakdown;
  open: boolean;
  onClose: () => void;
}) {
  const { run, pending, error } = useAction();

  function dismiss() {
    run(async () => {
      const result = await acknowledgeCostGap(sub.id, cost.gap);
      if (!result.error) onClose();
      return result;
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Totals do not match">
      <div className="stack gap-16">
        <p style={{ fontSize: 15 }}>
          The confirmed receipts on {sub.name} come to {money(cost.receiptOverride ?? 0)}. What was
          entered by
          hand — the bid, the change orders and the amount paid — comes to {money(cost.manual)}, a
          difference of {money(Math.abs(cost.gap))}.
        </p>

        <p style={{ fontSize: 15 }}>
          The receipts are what count toward the phase total, so nothing is adding up wrong.
          Dismissing only stops the row flagging it, and it comes back if either figure moves.
        </p>

        {error ? <div className="notice">{error}</div> : null}

        <div className="dialog-foot">
          <button type="button" className="btn ghost sm" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn sm" onClick={dismiss} disabled={pending}>
            {pending ? "Dismissing…" : "Dismiss"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Add / edit share one form — the fields are identical (spec §3). */
function SubDialog({
  phaseId,
  sub,
  open,
  onClose,
}: {
  phaseId: string;
  sub?: SubWithDetail;
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    sub ? updateSub : createSub,
    {},
  );
  useCloseOnSuccess(state, open, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sub ? "Edit subcontractor" : "New subcontractor"}
    >
      <form action={formAction} className="stack gap-16">
        {sub ? (
          <input type="hidden" name="id" value={sub.id} />
        ) : (
          <input type="hidden" name="phase_id" value={phaseId} />
        )}

        <div className="formgrid">
          <label className="field">
            <span>Name</span>
            <input type="text" name="name" required defaultValue={sub?.name ?? ""} />
          </label>
          <label className="field">
            <span>Company</span>
            <input type="text" name="company" defaultValue={sub?.company ?? ""} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input type="tel" name="phone" defaultValue={sub?.phone ?? ""} />
          </label>
          <label className="field">
            <span>Bid price</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="bid_price"
              defaultValue={sub?.bid_price ?? ""}
              placeholder="0.00"
            />
          </label>
        </div>

        <ErrorNote state={state} />

        <div className="dialog-foot">
          <button type="button" className="btn ghost sm" onClick={onClose}>
            Cancel
          </button>
          <SubmitButton className="btn sm">{sub ? "Save" : "Add subcontractor"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

/** Spec §3: extra scope on an existing sub, not a second sub entry. */
function ChangeOrderDialog({
  subId,
  open,
  onClose,
}: {
  subId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(createChangeOrder, {});
  useCloseOnSuccess(state, open, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change order"
    >
      <form action={formAction} className="stack gap-16">
        <input type="hidden" name="subcontractor_id" value={subId} />

        <label className="field">
          <span>What was added</span>
          <input type="text" name="description" required placeholder="Storage unit addition" />
        </label>

        <label className="field">
          <span>Amount</span>
          <input type="number" step="0.01" name="amount" required placeholder="0.00" />
        </label>

        <ErrorNote state={state} />

        <div className="dialog-foot">
          <button type="button" className="btn ghost sm" onClick={onClose}>
            Cancel
          </button>
          <SubmitButton className="btn sm">Add change order</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
