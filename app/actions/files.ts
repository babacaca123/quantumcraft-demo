"use server";

import { revalidatePath } from "next/cache";
import { getOrCreateProject, requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

const MAX_BYTES = 25 * 1024 * 1024;

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

/**
 * Spec §6: any sub or task can carry files — receipts, photos, plans, checks.
 *
 * Only a receipt carries a price, so upload asks nothing but the file and
 * whether it is one. When it is, the caller opens the details dialog once on
 * the id returned here. v2 replaces the tick with extraction; the shape of the
 * data does not change.
 */
export async function uploadAttachment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_BYTES) return { error: "That file is larger than 25 MB." };

  const phaseId = String(formData.get("phase_id") ?? "");
  const subId = text(formData.get("subcontractor_id"));
  const taskId = text(formData.get("task_id"));

  if (!phaseId) return { error: "Missing phase." };
  if (Boolean(subId) === Boolean(taskId)) {
    return { error: "A file attaches to exactly one subcontractor or task." };
  }

  const isReceipt = formData.get("is_receipt") === "on";

  const { supabase, project, userId } = await getOrCreateProject();
  const path = storageKey(userId, file.name);

  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data: row, error } = await supabase
    .from("attachments")
    .insert({
      user_id: userId,
      project_id: project.id,
      phase_id: phaseId,
      subcontractor_id: subId,
      task_id: taskId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      is_receipt: isReceipt,
    })
    .select("id")
    .single();

  if (error) {
    // Don't leave an orphan object in the bucket if the row insert fails.
    await supabase.storage.from("attachments").remove([path]);
    return { error: error.message };
  }

  refresh();
  // The id lets the panel pop the details dialog for a receipt exactly once.
  return { ok: true, id: isReceipt ? row.id : undefined };
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
