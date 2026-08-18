"use client";

import { useActionState, useEffect, useState } from "react";
import { uploadAttachment } from "@/app/actions/files";
import { ReceiptEditDialog } from "@/components/attachments/receipt-dialog";
import { FileThumb } from "@/components/attachments/file-preview";
import { ErrorNote, Modal, SubmitButton, useCloseOnSuccess } from "@/components/ui";
import { money } from "@/lib/costs";
import { shortName } from "@/lib/files";
import type { ActionResult, Attachment } from "@/lib/types";

/**
 * Files on a sub or a task (spec §6). Receipts, photos, plans, checks — anything.
 *
 * A file has no price unless it is a receipt. Marking it as one on upload pops
 * the details dialog a single time, right after; after that the amount is only
 * ever revisited through "Details", so the form is never in the way.
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
  const [pendingReceiptId, setPendingReceiptId] = useState<string | null>(null);

  /**
   * The upload action hands back an id only when the file was flagged as a
   * receipt. Once revalidation delivers that row, open its details once — then
   * drop the id so it never opens itself again.
   */
  useEffect(() => {
    if (!pendingReceiptId) return;
    const uploaded = attachments.find((a) => a.id === pendingReceiptId);
    if (uploaded) {
      setEditing(uploaded);
      setPendingReceiptId(null);
    }
  }, [pendingReceiptId, attachments]);

  return (
    <>
      {attachments.length > 0 ? (
        <div className="attachrow">
          {attachments.map((file) => (
            <button
              key={file.id}
              type="button"
              className="filechip"
              onClick={() => setEditing(file)}
              title={file.file_name}
            >
              <FileThumb file={file} signedUrl={signedUrls[file.storage_path] ?? null} size={38} />
              <span className="filechip-text">
                <span className="filechip-name">{shortName(file.file_name, 22)}</span>
                {file.is_receipt ? (
                  <span className={`micro ${file.is_confirmed ? "route" : "rust"}`}>
                    {file.amount != null ? money(file.amount) : "no amount"}
                    {file.is_confirmed ? " · confirmed" : ""}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="row gap-8 wrapped" style={{ marginTop: attachments.length ? 10 : 6 }}>
        <button type="button" className="linkbtn" onClick={() => setUploading(true)}>
          + Attach file
        </button>
      </div>

      <UploadDialog
        open={uploading}
        onClose={() => setUploading(false)}
        onUploadedReceipt={setPendingReceiptId}
        phaseId={phaseId}
        subcontractorId={subcontractorId}
        taskId={taskId}
      />

      <ReceiptEditDialog
        file={editing}
        signedUrl={editing ? (signedUrls[editing.storage_path] ?? null) : null}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function UploadDialog({
  open,
  onClose,
  onUploadedReceipt,
  phaseId,
  subcontractorId,
  taskId,
}: {
  open: boolean;
  onClose: () => void;
  onUploadedReceipt: (id: string) => void;
  phaseId: string;
  subcontractorId?: string;
  taskId?: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(uploadAttachment, {});
  useCloseOnSuccess(state, open, onClose);

  useEffect(() => {
    if (state.ok && state.id) onUploadedReceipt(state.id);
  }, [state, onUploadedReceipt]);

  return (
    <Modal open={open} onClose={onClose} title="Attach a file">
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

        <label className="checkrow">
          <input type="checkbox" name="is_receipt" />
          <span>
            This is a receipt.
            <span className="micro block">
              Only a receipt carries a price — you&rsquo;ll be asked for the amount next.
            </span>
          </span>
        </label>

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
