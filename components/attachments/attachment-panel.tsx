"use client";

import { useActionState, useEffect, useState } from "react";
import { deleteAttachment, uploadAttachment } from "@/app/actions/files";
import { ReceiptEditDialog } from "@/components/attachments/receipt-dialog";
import { FileThumb } from "@/components/attachments/file-preview";
import { ErrorNote, Modal, SubmitButton, useAction, useCloseOnSuccess } from "@/components/ui";
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
  const [freshReceiptId, setFreshReceiptId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Attachment | null>(null);

  /**
   * The upload action hands back an id only when the file was flagged as a
   * receipt. Once revalidation delivers that row, open its details once — then
   * drop the id so it never opens itself again.
   *
   * `freshReceiptId` outlives that handover: it is what tells the dialog this
   * file has never been read, so extraction runs on the upload and never again
   * when the same receipt is reopened from its chip.
   */
  useEffect(() => {
    if (!pendingReceiptId) return;
    const uploaded = attachments.find((a) => a.id === pendingReceiptId);
    if (uploaded) {
      setEditing(uploaded);
      setFreshReceiptId(uploaded.id);
      setPendingReceiptId(null);
    }
  }, [pendingReceiptId, attachments]);

  return (
    <>
      {attachments.length > 0 ? (
        <div className="attachrow">
          {attachments.map((file) => (
            <div key={file.id} className="filechip">
              <button
                type="button"
                className="filechip-open"
                onClick={() => setEditing(file)}
                title={file.file_name}
              >
                <FileThumb
                  file={file}
                  signedUrl={signedUrls[file.storage_path] ?? null}
                  size={38}
                />
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

              {/* Removing a file where it lives, rather than only from All Files. */}
              <button
                type="button"
                className="filechip-trash"
                aria-label={`Delete ${file.file_name}`}
                title="Delete file"
                onClick={() => setDeleting(file)}
              >
                <TrashIcon />
              </button>
            </div>
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
        extract={Boolean(editing) && editing?.id === freshReceiptId}
        onClose={() => {
          setEditing(null);
          setFreshReceiptId(null);
        }}
      />

      <DeleteFileDialog file={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

/** A bin, drawn — the chip has no room to spell the word out. */
function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.6 4h10.8" />
      <path d="M6.4 4V2.7h3.2V4" />
      <path d="M4.2 4l.6 9a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-9" />
      <path d="M6.7 6.8v4.5M9.3 6.8v4.5" />
    </svg>
  );
}

/**
 * The bin arms this rather than firing: deleting takes the object out of the
 * bucket along with its row, and nothing brings either back. A confirmed receipt
 * earns a second line, because its amount is the one currently counting — losing
 * it hands the phase total back to whatever was entered by hand (spec §5).
 */
function DeleteFileDialog({ file, onClose }: { file: Attachment | null; onClose: () => void }) {
  const { run, pending, error } = useAction();

  function handleDelete() {
    if (!file) return;
    const { id } = file;
    run(async () => {
      const result = await deleteAttachment(id);
      if (!result.error) onClose();
      return result;
    });
  }

  return (
    <Modal open={Boolean(file)} onClose={onClose} title="Delete file">
      {file ? (
        <div className="stack gap-16">
          <p style={{ fontSize: 15 }}>
            Delete <span className="mono">{file.file_name}</span>? This removes the file itself,
            not just the link to it, and cannot be undone.
          </p>

          {file.is_confirmed && file.amount != null ? (
            <div className="notice">
              {money(file.amount)} counts toward this phase through this receipt. Deleting it hands
              the total back to the amount entered by hand.
            </div>
          ) : null}

          {error ? <div className="notice">{error}</div> : null}

          <div className="dialog-foot">
            <button type="button" className="btn ghost sm" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button
              type="button"
              className="btn danger sm"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete file"}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
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
          {/* Photos and PDFs — the two things a receipt ever arrives as, and the
              two the reader can look at. */}
          <input type="file" name="file" accept="image/*,application/pdf" required />
        </label>

        <label className="checkrow">
          <input type="checkbox" name="is_receipt" />
          <span>
            This is a receipt.
            <span className="micro block">
              Only a receipt carries a price — the date, vendor and amount are read off it next, for
              you to check.
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
