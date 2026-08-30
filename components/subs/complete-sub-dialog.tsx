"use client";

import { useActionState, useEffect, useRef } from "react";
import { completeSub } from "@/app/actions/tracker";
import { ErrorNote, Modal, SubmitButton, useCloseOnSuccess } from "@/components/ui";
import { money, moneyOrDash, subCost } from "@/lib/costs";
import type { ActionResult, SubWithDetail } from "@/lib/types";

/**
 * Spec §3: checking a sub off asks what was *actually* paid, which is often less
 * than the bid when work came in incomplete or poor. The figure counts toward
 * the phase total immediately — no receipt required.
 *
 * It is one all-in number covering the main order and every change order, so it
 * replaces the projection outright rather than being added to it.
 *
 * Which is why what it offers is never simply the figure already on record: a
 * change order raised since is not inside that figure, and coming back here is
 * how it gets folded in. The suggestion is what the sub comes to as it stands.
 */
export function CompleteSubDialog({
  sub,
  open,
  onClose,
}: {
  sub: SubWithDetail;
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(completeSub, {});
  const cost = subCost(sub);
  useCloseOnSuccess(state, open, onClose);

  // Nothing on record to base a figure on — an unbid sub opens blank rather than
  // on a suggested zero.
  const seeded = sub.paid_amount != null || cost.bid > 0 || cost.changeOrders > 0;
  const settledWithScopeSince = sub.paid_amount != null && cost.uncoveredChangeOrders > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mark ${sub.name} done`}
    >
      {/* Remounted whenever the suggestion moves, because this dialog never
          unmounts — a defaultValue set on the first render would otherwise be
          the one still sitting there a change order later. */}
      <form action={formAction} className="stack gap-16" key={`${open}:${cost.allIn}`}>
        <input type="hidden" name="id" value={sub.id} />

        <label className="field">
          <span>Total actually paid</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="paid_amount"
            required
            autoFocus
            defaultValue={seeded ? cost.allIn : ""}
            placeholder="0.00"
          />
        </label>

        <div className="micro">
          {settledWithScopeSince ? (
            <>
              {money(sub.paid_amount)} paid + {money(cost.uncoveredChangeOrders)} in change orders
              since — this figure covers all of it
            </>
          ) : (
            <>
              bid {moneyOrDash(sub.bid_price)}
              {cost.changeOrders > 0 ? ` + ${money(cost.changeOrders)} change orders` : ""} — this
              figure covers all of it
            </>
          )}
        </div>

        <ErrorNote state={state} />

        <div className="dialog-foot">
          <button type="button" className="btn ghost sm" onClick={onClose}>
            Cancel
          </button>
          <SubmitButton className="btn sm">Save paid amount</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
