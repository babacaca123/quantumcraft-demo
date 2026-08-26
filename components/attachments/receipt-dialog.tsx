"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateAttachment } from "@/app/actions/files";
import { ErrorNote, Modal, SubmitButton, useCloseOnSuccess } from "@/components/ui";
import { FilePreview } from "@/components/attachments/file-preview";
import { extractReceipt } from "@/lib/extract-receipt";
import type { ActionResult, Attachment, Extraction } from "@/lib/types";

/**
 * Date / vendor / amount — the three fields extraction pre-fills (spec §9).
 * They stay hand-editable either way, and confirming is a separate, deliberate
 * tick because a misread amount moves the project total.
 */
export function ReceiptFields({
  defaults,
  disabled = false,
}: {
  defaults?: Pick<Attachment, "receipt_date" | "vendor" | "amount" | "is_confirmed">;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="formgrid">
        <label className="field">
          <span>Receipt date</span>
          <input
            type="date"
            name="receipt_date"
            defaultValue={defaults?.receipt_date ?? ""}
            disabled={disabled}
          />
        </label>
        <label className="field">
          <span>Vendor</span>
          <input
            type="text"
            name="vendor"
            defaultValue={defaults?.vendor ?? ""}
            placeholder="Home Depot"
            disabled={disabled}
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
            disabled={disabled}
          />
        </label>
      </div>

      <label className="checkrow">
        <input
          type="checkbox"
          name="is_confirmed"
          defaultChecked={defaults?.is_confirmed}
          disabled={disabled}
        />
        <span>Confirmed — use this amount as the cost, overriding what was entered by hand.</span>
      </label>
    </>
  );
}

type Reading =
  | { status: "off" }
  | { status: "working" }
  | { status: "done"; values: Extraction }
  | { status: "failed" };

/**
 * Runs the read once, for the file a receipt upload just produced.
 *
 * `file` and `signedUrl` arrive fresh on every revalidation, so the effect keys
 * off the id alone and reads the rest through a ref — otherwise a background
 * refresh would re-run the extraction behind the user's back.
 */
function useReading(
  file: Attachment | null,
  signedUrl: string | null | undefined,
  enabled: boolean,
): Reading {
  const [reading, setReading] = useState<Reading>({ status: "off" });
  const latest = useRef({ file, signedUrl });
  latest.current = { file, signedUrl };

  const id = enabled ? (file?.id ?? null) : null;

  useEffect(() => {
    if (!id) {
      setReading({ status: "off" });
      return;
    }

    const target = latest.current.file;
    if (!target) return;

    let cancelled = false;
    setReading({ status: "working" });

    extractReceipt(target, latest.current.signedUrl ?? null)
      .then((values) => {
        if (!cancelled) setReading({ status: "done", values });
      })
      .catch(() => {
        if (!cancelled) setReading({ status: "failed" });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return reading;
}

/**
 * The receipt details on an uploaded file. Opens itself once right after a
 * receipt is uploaded — with `extract` set, so the fields arrive filled in —
 * and is reachable from the file chip forever after, so getting it wrong or
 * skipping it the first time costs nothing.
 */
export function ReceiptEditDialog({
  file,
  signedUrl,
  extract = false,
  onClose,
}: {
  file: Attachment | null;
  signedUrl?: string | null;
  /** Read the file first and pre-fill from it. Only ever true for a fresh upload. */
  extract?: boolean;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(updateAttachment, {});
  useCloseOnSuccess(state, Boolean(file), onClose);

  const reading = useReading(file, signedUrl, extract);
  const working = reading.status === "working";
  const read = reading.status === "done" ? reading.values : null;

  return (
    <Modal open={Boolean(file)} onClose={onClose} title="Receipt details">
      {file ? (
        <form action={formAction} className="stack gap-16" key={file.id}>
          <input type="hidden" name="id" value={file.id} />

          <FilePreview file={file} signedUrl={signedUrl ?? null} />

          {working ? (
            <div className="notice">
              Reading the receipt — the fields fill themselves in a moment.
            </div>
          ) : null}
          {reading.status === "failed" ? (
            <div className="notice">Couldn&rsquo;t read this one. Enter the details by hand.</div>
          ) : null}
          {read && read.amount == null && read.vendor == null && read.date == null ? (
            <div className="notice">Nothing legible on this one. Enter the details by hand.</div>
          ) : null}

          {/* Remounted the moment the read lands, so the values it found become
              the fields' defaults. Safe because the fields are disabled until
              then — there is never anything typed to overwrite. */}
          <ReceiptFields
            key={reading.status}
            disabled={working}
            defaults={{
              receipt_date: read?.date ?? file.receipt_date,
              vendor: read?.vendor ?? file.vendor,
              amount: read?.amount ?? file.amount,
              // Never pre-ticked off a reading: an extracted figure counts for
              // nothing until someone has looked at it (spec §6).
              is_confirmed: file.is_confirmed,
            }}
          />

          <ErrorNote state={state} />

          <div className="dialog-foot">
            <button type="button" className="btn ghost sm" onClick={onClose}>
              Cancel
            </button>
            <SubmitButton className="btn sm" disabled={working}>
              Save
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
