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
 * Receipt fields are typed in by hand in v1 (v2 pre-fills them by extraction);
 * either way nothing counts toward cost until "confirmed" is ticked.
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

  const amount = num(formData.get("amount"));
  const isConfirmed = formData.get("is_confirmed") === "on";
  if (isConfirmed && amount == null) {
    return { error: "Confirming a receipt needs an amount — that figure overrides the cost." };
  }

  const { supabase, project, userId } = await getOrCreateProject();
  const path = storageKey(userId, file.name);

  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("attachments").insert({
    user_id: userId,
    project_id: project.id,
    phase_id: phaseId,
    subcontractor_id: subId,
    task_id: taskId,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    receipt_date: text(formData.get("receipt_date")),
    vendor: text(formData.get("vendor")),
    amount,
    is_confirmed: isConfirmed,
  });

  if (error) {
    // Don't leave an orphan object in the bucket if the row insert fails.
    await supabase.storage.from("attachments").remove([path]);
    return { error: error.message };
  }

  refresh();
  return { ok: true };
}

/**
 * Editing the extracted values and confirming them. Confirming is the moment the
 * receipt's amount takes over from the manually-entered figure (spec §5) — which
 * is exactly why it is never applied silently.
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
