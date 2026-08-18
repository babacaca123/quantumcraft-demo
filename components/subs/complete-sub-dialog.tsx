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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mark ${sub.name} done`}
    >
      <form action={formAction} className="stack gap-16">
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
            defaultValue={sub.paid_amount ?? (cost.bid || cost.changeOrders ? cost.manual : "")}
            placeholder="0.00"
          />
        </label>

        <div className="micro">
          bid {moneyOrDash(sub.bid_price)}
          {cost.changeOrders > 0 ? ` + ${money(cost.changeOrders)} change orders` : ""} —
          this figure covers all of it
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
