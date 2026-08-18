"use client";

import { useActionState, useState } from "react";
import { deleteAttachment, uploadAttachment } from "@/app/actions/files";
import {
  ReceiptEditDialog,
  ReceiptFields,
  useCloseOnSuccess,
} from "@/components/attachments/receipt-dialog";
import { DeleteButton, ErrorNote, Modal, SubmitButton } from "@/components/ui";
import { formatDate, money } from "@/lib/costs";
import type { ActionResult, Attachment } from "@/lib/types";

/**
 * Files on a sub or a task (spec §6). Receipts, photos, plans, checks — anything.
 * The receipt fields are optional; ticking "confirmed" is what makes an amount
 * override the manually-entered cost.
 */
export function AttachmentPanel({
  phaseId,
  subcontractorId,
  taskId,
  attachments,
  signedUrls,
}: {
  phaseId: string;
  subcontractorId?: string;
  taskId?: string;
  attachments: Attachment[];
  signedUrls: Record<string, string>;
}) {
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Attachment | null>(null);

  return (
    <>
      {attachments.map((file) => (
        <div key={file.id} className="subrow">
          <span aria-hidden="true">📎</span>
          <span>
            {signedUrls[file.storage_path] ? (
              <a href={signedUrls[file.storage_path]} target="_blank" rel="noreferrer">
                {file.file_name}
              </a>
            ) : (
              file.file_name
            )}
            {file.vendor ? ` · ${file.vendor}` : ""}
            {file.receipt_date ? ` · ${formatDate(file.receipt_date)}` : ""}
          </span>

          <span className="amt">
            {file.amount != null ? (
              <>
                {money(file.amount)}
                <span className={file.is_confirmed ? "route" : "rust"}>
                  {file.is_confirmed ? " · confirmed" : " · unconfirmed"}
                </span>
              </>
            ) : (
              "no amount"
            )}
          </span>

          <button type="button" className="linkbtn" onClick={() => setEditing(file)}>
            Edit
          </button>
          <DeleteButton onDelete={() => deleteAttachment(file.id)} label="Remove" />
        </div>
      ))}

      <div className="subrow">
        <button type="button" className="linkbtn" onClick={() => setUploading(true)}>
          + Attach file
        </button>
      </div>

      <UploadDialog
        open={uploading}
        onClose={() => setUploading(false)}
        phaseId={phaseId}
        subcontractorId={subcontractorId}
        taskId={taskId}
      />

      <ReceiptEditDialog file={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function UploadDialog({
  open,
  onClose,
  phaseId,
  subcontractorId,
  taskId,
}: {
  open: boolean;
  onClose: () => void;
  phaseId: string;
  subcontractorId?: string;
  taskId?: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(uploadAttachment, {});
  useCloseOnSuccess(state, open, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attach a file"
      hint="receipt, photo, plan, check — the receipt fields are optional"
    >
      <form action={formAction} className="stack gap-16">
        <input type="hidden" name="phase_id" value={phaseId} />
        {subcontractorId ? (
          <input type="hidden" name="subcontractor_id" value={subcontractorId} />
        ) : null}
        {taskId ? <input type="hidden" name="task_id" value={taskId} /> : null}

        <label className="field">
          <span>File</span>
          <input type="file" name="file" required />
        </label>

        <ReceiptFields />

        <ErrorNote state={state} />

        <div className="dialog-foot">
          <button type="button" className="btn ghost sm" onClick={onClose}>
            Cancel
          </button>
          <SubmitButton className="btn sm" pendingLabel="Uploading…">
            Upload
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
