"use server";

import { revalidatePath } from "next/cache";
import { getOrCreateProject, requireUser } from "@/lib/auth";
import { MAX_UPLOAD_BYTES } from "@/lib/files";
import type { ActionResult, UploadTarget } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

function num(value: FormDataEntryValue | null): number | null {
  if (value == null) return null;
  const cleaned = String(value).trim().replace(/[$,]/g, "");
  if (cleaned === "") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/** Storage keys are `<user id>/<uuid>-<name>` so the bucket policy is a prefix check. */
function storageKey(userId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return `${userId}/${crypto.randomUUID()}-${safe}`;
}

/** A file hangs off exactly one sub or one task — never both, never neither. */
function checkTarget(phaseId: string, subId?: string, taskId?: string): string | null {
  if (!phaseId) return "Missing phase.";
  if (Boolean(subId) === Boolean(taskId)) {
    return "A file attaches to exactly one subcontractor or task.";
  }
  return null;
}

/**
 * Spec §6: any sub or task can carry files — receipts, photos, plans, checks.
 * This is the first half of putting one there: where it goes, and a pass to
 * write it.
 *
 * The bytes do not come through this app. A Server Action request body is
 * capped at 1 MB, and a serverless function's at 4.5 MB with no setting that
 * lifts it — limits a photo off a phone clears without trying, which is why
 * attaching one came back a server error before the size check here was ever
 * reached. The browser uploads to Storage itself; the server handles only the
 * paperwork, at both ends.
 *
 * The key is minted here rather than accepted from the caller, because it
 * carries the user id the bucket policy checks, and the pass it comes back with
 * is good for that one path and nothing else.
 */
export async function createUploadTarget(input: {
  phaseId: string;
  subcontractorId?: string;
  taskId?: string;
  fileName: string;
  size: number;
}): Promise<UploadTarget> {
  const problem = checkTarget(input.phaseId, input.subcontractorId, input.taskId);
  if (problem) return { error: problem };
  if (!input.size) return { error: "Choose a file to upload." };
  if (input.size > MAX_UPLOAD_BYTES) return { error: "That file is larger than 25 MB." };

  const { supabase, user } = await requireUser();
  const path = storageKey(user.id, input.fileName);

  const { data, error } = await supabase.storage.from("attachments").createSignedUploadUrl(path);
  if (error) return { error: error.message };

  return { path, token: data.token };
}

/**
 * The second half: the row about a file that is already in the bucket.
 *
 * Only a receipt carries a price, so upload asks nothing but the file and
 * whether it is one. When it is, the caller opens the details dialog once on
 * the id returned here.
 */
export async function recordAttachment(input: {
  path: string;
  phaseId: string;
  subcontractorId?: string;
  taskId?: string;
  fileName: string;
  mimeType?: string | null;
  size: number;
  isReceipt: boolean;
}): Promise<ActionResult> {
  const problem = checkTarget(input.phaseId, input.subcontractorId, input.taskId);
  if (problem) return { error: problem };

  const { supabase, project, userId } = await getOrCreateProject();

  // The one field the caller could have swapped for something else. A key
  // outside the user's own folder would never have uploaded, and it does not
  // get recorded either.
  if (!input.path.startsWith(`${userId}/`)) {
    return { error: "That file is not yours to attach." };
  }

  const { data: row, error } = await supabase
    .from("attachments")
    .insert({
      user_id: userId,
      project_id: project.id,
      phase_id: input.phaseId,
      subcontractor_id: input.subcontractorId ?? null,
      task_id: input.taskId ?? null,
      storage_path: input.path,
      file_name: input.fileName,
      mime_type: input.mimeType || null,
      size_bytes: input.size,
      is_receipt: input.isReceipt,
    })
    .select("id")
    .single();

  if (error) {
    // Don't leave an orphan object in the bucket if the row insert fails.
    await supabase.storage.from("attachments").remove([input.path]);
    return { error: error.message };
  }

  refresh();
  // The id lets the panel pop the details dialog for a receipt exactly once.
  return { ok: true, id: input.isReceipt ? row.id : undefined };
}

/**
 * The receipt details, and confirming them. Confirming is the moment the
 * receipt's amount takes over from the manually-entered figure (spec §5) — which
 * is exactly why it is never applied silently, and why extraction only ever
 * fills the form in. Reachable any time from the file's chip, so it never has
 * to be got right on the first pass.
 *
 * The override is a reading, never a write: nothing in this file touches
 * `subcontractors.paid_amount` or `tasks.price`. Those hold what the user typed
 * and keep holding it, and `lib/costs.ts` decides at display time which figure
 * counts. That is what makes unconfirming or deleting a receipt reversible.
 */
export async function updateAttachment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing file." };

  const amount = num(formData.get("amount"));
  const isConfirmed = formData.get("is_confirmed") === "on";
  if (isConfirmed && amount == null) {
    return { error: "Confirming a receipt needs an amount — that figure overrides the cost." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("attachments")
    .update({
      // Filling anything in here makes it a receipt by definition.
      is_receipt: true,
      receipt_date: text(formData.get("receipt_date")),
      vendor: text(formData.get("vendor")),
      amount,
      is_confirmed: isConfirmed,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  refresh();
  return { ok: true };
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const { data: row, error: readError } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (readError) return { error: readError.message };

  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) return { error: error.message };

  if (row?.storage_path) {
    await supabase.storage.from("attachments").remove([row.storage_path]);
  }

  refresh();
  return { ok: true };
}
