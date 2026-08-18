"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateAttachment } from "@/app/actions/files";
import { ErrorNote, Modal, SubmitButton } from "@/components/ui";
import type { ActionResult, Attachment } from "@/lib/types";

/** Closes a dialog once its action reports success. */
export function useCloseOnSuccess(state: ActionResult, open: boolean, close: () => void) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) wasOpen.current = true;
    if (wasOpen.current && state.ok) close();
  }, [state, open, close]);
}

/**
 * Date / vendor / amount — the three fields v2 will pre-fill by extraction
 * (spec §9). They stay hand-editable either way, and confirming is a separate,
 * deliberate tick because OCR misreads amounts and this figure moves the total.
 */
export function ReceiptFields({
  defaults,
}: {
  defaults?: Pick<Attachment, "receipt_date" | "vendor" | "amount" | "is_confirmed">;
}) {
  return (
    <>
      <div className="formgrid">
        <label className="field">
          <span>Receipt date</span>
          <input type="date" name="receipt_date" defaultValue={defaults?.receipt_date ?? ""} />
        </label>
        <label className="field">
          <span>Vendor</span>
          <input
            type="text"
            name="vendor"
            defaultValue={defaults?.vendor ?? ""}
            placeholder="Home Depot"
          />
        </label>
        <label className="field">
          <span>Amount</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="amount"
            defaultValue={defaults?.amount ?? ""}
            placeholder="0.00"
          />
        </label>
      </div>

      <label className="row gap-8" style={{ alignItems: "flex-start" }}>
        <input type="checkbox" name="is_confirmed" defaultChecked={defaults?.is_confirmed} />
        <span style={{ fontSize: 14 }}>
          Confirmed — use this amount as the cost, overriding what was entered by hand.
        </span>
      </label>
    </>
  );
}

/** Edit the receipt details on a file that is already uploaded. */
export function ReceiptEditDialog({
  file,
  onClose,
}: {
  file: Attachment | null;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(updateAttachment, {});
  useCloseOnSuccess(state, Boolean(file), onClose);

  return (
    <Modal
      open={Boolean(file)}
      onClose={onClose}
      title="Receipt details"
      hint="confirming makes this amount override the figure entered by hand"
    >
      {file ? (
        <form action={formAction} className="stack gap-16" key={file.id}>
          <input type="hidden" name="id" value={file.id} />
          <div className="micro">{file.file_name}</div>

          <ReceiptFields defaults={file} />

          <ErrorNote state={state} />

          <div className="dialog-foot">
            <button type="button" className="btn ghost sm" onClick={onClose}>
              Cancel
            </button>
            <SubmitButton className="btn sm">Save</SubmitButton>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
