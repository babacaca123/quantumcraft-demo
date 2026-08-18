"use client";

import { useActionState } from "react";
import { updateAttachment } from "@/app/actions/files";
import { ErrorNote, Modal, SubmitButton, useCloseOnSuccess } from "@/components/ui";
import { FilePreview } from "@/components/attachments/file-preview";
import type { ActionResult, Attachment } from "@/lib/types";

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

      <label className="checkrow">
        <input type="checkbox" name="is_confirmed" defaultChecked={defaults?.is_confirmed} />
        <span>Confirmed — use this amount as the cost, overriding what was entered by hand.</span>
      </label>
    </>
  );
}

/**
 * The receipt details on an uploaded file. Opens itself once right after a
 * receipt is uploaded, and is reachable from the file's "Details" button
 * forever after — so getting it wrong or skipping it the first time costs
 * nothing.
 */
export function ReceiptEditDialog({
  file,
  signedUrl,
  onClose,
}: {
  file: Attachment | null;
  signedUrl?: string | null;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(updateAttachment, {});
  useCloseOnSuccess(state, Boolean(file), onClose);

  return (
    <Modal open={Boolean(file)} onClose={onClose} title="Receipt details">
      {file ? (
        <form action={formAction} className="stack gap-16" key={file.id}>
          <input type="hidden" name="id" value={file.id} />

          <FilePreview file={file} signedUrl={signedUrl ?? null} />

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
