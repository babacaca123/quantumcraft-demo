"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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

/**
 * A phone or tablet — something you can hold up to a receipt. Read at click
 * time rather than on render, so the server and the first paint agree.
 */
function handheld(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches &&
    navigator.maxTouchPoints > 0
  );
}

/** Photograph the receipt where it is: the camera, on the Scan button. */
function CameraIcon() {
  return (
    <Icon>
      <path d="M1.4 6.2a1.2 1.2 0 0 1 1.2-1.2h1.9l1-1.6h5l1 1.6h1.9a1.2 1.2 0 0 1 1.2 1.2v6.2a1.2 1.2 0 0 1-1.2 1.2H2.6a1.2 1.2 0 0 1-1.2-1.2Z" />
      <circle cx="8" cy="9.2" r="2.2" />
    </Icon>
  );
}

/** A file already on the device: the paperclip, on the Attach button. */
function ClipIcon() {
  return (
    <Icon>
      <path d="M11.7 7.5 7.3 11.9a2.5 2.5 0 0 1-3.5-3.5l5.1-5.1a1.7 1.7 0 0 1 2.4 2.4l-5.1 5.1a0.8 0.8 0 0 1-1.2-1.2l4.5-4.5" />
    </Icon>
  );
}

/** The one drawing style these buttons share: 16px, stroked, no fill. */
function Icon({ children }: { children: React.ReactNode }) {
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
      {children}
    </svg>
  );
}

/** A bin, drawn — the chip has no room to spell the word out. */
function TrashIcon() {
  return (
    <Icon>
      <path d="M2.6 4h10.8" />
      <path d="M6.4 4V2.7h3.2V4" />
      <path d="M4.2 4l.6 9a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-9" />
      <path d="M6.7 6.8v4.5M9.3 6.8v4.5" />
    </Icon>
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

  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok && state.id) onUploadedReceipt(state.id);
  }, [state, onUploadedReceipt]);

  // A closed dialog forgets what was in it, so the next file starts from nothing
  // rather than reopening on the last one's name and receipt tick.
  useEffect(() => {
    if (!open) {
      formRef.current?.reset();
      setChosen(null);
    }
  }, [open]);

  /**
   * One input, opened two ways. `capture` is what turns the picker into the
   * camera, and it has to be on the element before the click lands — so this
   * reaches for the node rather than routing through state and waiting a render.
   *
   * Scan only asks for the camera on a device that has one to point at a
   * receipt; anywhere else it is Attach, PDFs and all. Attach never captures, so
   * on a phone it offers the camera roll and on a computer the file browser.
   */
  function pick(scan: boolean) {
    const input = fileRef.current;
    if (!input) return;
    if (scan && handheld()) {
      input.setAttribute("capture", "environment");
      input.setAttribute("accept", "image/*");
    } else {
      input.removeAttribute("capture");
      input.setAttribute("accept", "image/*,application/pdf");
    }
    input.click();
  }

  return (
    <Modal open={open} onClose={onClose} title="Attach a file">
      <form ref={formRef} action={formAction} className="stack gap-16">
        <input type="hidden" name="phase_id" value={phaseId} />
        {subcontractorId ? (
          <input type="hidden" name="subcontractor_id" value={subcontractorId} />
        ) : null}
        {taskId ? <input type="hidden" name="task_id" value={taskId} /> : null}

        <div className="field">
          <span>File</span>
          <div className="filepick">
            <button type="button" className="linkbtn" onClick={() => pick(true)}>
              <CameraIcon />
              Scan
            </button>
            <button type="button" className="linkbtn" onClick={() => pick(false)}>
              <ClipIcon />
              Attach
            </button>
            <span className={`filepick-name ${chosen ? "set" : ""}`}>
              {chosen ?? "nothing chosen yet"}
            </span>

            {/* Photos and PDFs — the two things a receipt ever arrives as, and
                the two the reader can look at. Not `required`: it is hidden, and
                a hidden required field fails validation with nothing on screen
                to explain it. The action says "Choose a file to upload." */}
            <input
              ref={fileRef}
              type="file"
              name="file"
              accept="image/*,application/pdf"
              onChange={(e) => setChosen(e.target.files?.[0]?.name ?? null)}
            />
          </div>
        </div>

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
