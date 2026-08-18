"use client";

import { useActionState, useEffect, useRef } from "react";
import { completeSub } from "@/app/actions/tracker";
import { ErrorNote, Modal, SubmitButton } from "@/components/ui";
import { moneyOrDash } from "@/lib/costs";
import type { ActionResult, SubWithDetail } from "@/lib/types";

/**
 * Spec §3: checking a sub off asks what was *actually* paid, which is often less
 * than the bid when work came in incomplete or poor. The figure counts toward
 * the phase total immediately — no receipt required.
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
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) wasOpen.current = true;
    if (wasOpen.current && state.ok) onClose();
  }, [state, open, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mark ${sub.name} done`}
      hint="counts toward the phase total straight away — receipts only correct it later"
    >
      <form action={formAction} className="stack gap-16">
        <input type="hidden" name="id" value={sub.id} />

        <label className="field">
          <span>Amount actually paid</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="paid_amount"
            required
            autoFocus
            defaultValue={sub.paid_amount ?? sub.bid_price ?? ""}
            placeholder="0.00"
          />
        </label>

        <div className="micro">bid on record: {moneyOrDash(sub.bid_price)}</div>

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
