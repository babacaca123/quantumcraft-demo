"use server";

import { revalidatePath } from "next/cache";
import { getOrCreateProject, requireUser } from "@/lib/auth";
import type { ActionResult, Priority, TaskSort } from "@/lib/types";

/**
 * Every mutation in the tracker. RLS already scopes rows to the signed-in user,
 * so these actions stay thin: validate, write, revalidate.
 *
 * Revalidating the whole layout is deliberate — a single edit moves the phase
 * total, the report and (for files) the All Files list, and the dataset is one
 * person's house build.
 */
function refresh() {
  revalidatePath("/", "layout");
}

function ok(): ActionResult {
  refresh();
  return { ok: true };
}

function fail(message: string): ActionResult {
  return { error: message };
}

/** "" and undefined both mean "not entered", which is distinct from 0. */
function num(value: FormDataEntryValue | null | undefined): number | null {
  if (value == null) return null;
  const text = String(value).trim().replace(/[$,]/g, "");
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: FormDataEntryValue | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

// ---------------------------------------------------------------- phases

export async function createPhase(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = text(formData.get("name"));
  if (!name) return fail("Give the phase a name.");

  const { supabase, project, userId } = await getOrCreateProject();

  const { data: last } = await supabase
    .from("phases")
    .select("position")
    .eq("project_id", project.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("phases").insert({
    user_id: userId,
    project_id: project.id,
    name,
    position: (last?.position ?? -1) + 1,
  });

  if (error) return fail(error.message);
  return ok();
}

export async function renamePhase(id: string, name: string): Promise<ActionResult> {
  const clean = name.trim();
  if (!clean) return fail("Give the phase a name.");

  const { supabase } = await requireUser();
  const { error } = await supabase.from("phases").update({ name: clean }).eq("id", id);

  if (error) return fail(error.message);
  return ok();
}

/** Spec §2: phases can be checked complete, but nothing locks or sequences them. */
export async function setPhaseComplete(id: string, isComplete: boolean): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("phases").update({ is_complete: isComplete }).eq("id", id);

  if (error) return fail(error.message);
  return ok();
}

export async function reorderPhases(orderedIds: string[]): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const updates = orderedIds.map((id, index) =>
    supabase.from("phases").update({ position: index }).eq("id", id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);

  if (failed?.error) return fail(failed.error.message);
  return ok();
}

export async function deletePhase(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("phases").delete().eq("id", id);

  if (error) return fail(error.message);
  return ok();
}

// ---------------------------------------------------------------- subcontractors

export async function createSub(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const phaseId = String(formData.get("phase_id") ?? "");
  const name = text(formData.get("name"));
  if (!phaseId) return fail("Missing phase.");
  if (!name) return fail("Give the subcontractor a name.");

  const { supabase, user } = await requireUser();

  const { data: last } = await supabase
    .from("subcontractors")
    .select("position")
    .eq("phase_id", phaseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("subcontractors").insert({
    user_id: user.id,
    phase_id: phaseId,
    name,
    company: text(formData.get("company")),
    phone: text(formData.get("phone")),
    bid_price: num(formData.get("bid_price")),
    position: (last?.position ?? -1) + 1,
  });

  if (error) return fail(error.message);
  return ok();
}

export async function updateSub(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const name = text(formData.get("name"));
  if (!id) return fail("Missing subcontractor.");
  if (!name) return fail("Give the subcontractor a name.");

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("subcontractors")
    .update({
      name,
      company: text(formData.get("company")),
      phone: text(formData.get("phone")),
      bid_price: num(formData.get("bid_price")),
    })
    .eq("id", id);

  if (error) return fail(error.message);
  return ok();
}

/** Spec §3: the star is scoped to this phase's copy of the sub, not the person. */
export async function toggleSubFavorite(id: string, isFavorite: boolean): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("subcontractors")
    .update({ is_favorite: isFavorite })
    .eq("id", id);

  if (error) return fail(error.message);
  return ok();
}

/**
 * Spec §3: checking a sub off asks what was actually paid, which may be less
 * than the bid for incomplete or bad work. That figure counts immediately.
 *
 * It is all-in for everything on the sub right now, so every change order's
 * "paid" tick resets — otherwise scope already inside this figure would be
 * added on top of it a second time.
 */
export async function completeSub(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const paid = num(formData.get("paid_amount"));
  if (!id) return fail("Missing subcontractor.");
  if (paid == null) return fail("Enter the amount actually paid.");
  if (paid < 0) return fail("Paid amount cannot be negative.");

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("subcontractors")
    .update({ is_complete: true, paid_amount: paid })
    .eq("id", id);

  if (error) return fail(error.message);

  // The figure just entered is all-in as of now, so every change order standing
  // on this sub is inside it — settled, with nothing left to add on top. Saying
  // so is what stops the same change order being counted twice: once through the
  // paid amount, and again through a tick box that claimed it was left out.
  const { error: resetError } = await supabase
    .from("change_orders")
    .update({ is_covered: true, is_paid: false })
    .eq("subcontractor_id", id);

  if (resetError) return fail(resetError.message);
  return ok();
}

export async function uncompleteSub(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("subcontractors")
    .update({ is_complete: false, paid_amount: null })
    .eq("id", id);

  if (error) return fail(error.message);

  // Back to a projection, where every change order counts through the bid — so
  // there is no paid amount left for any of them to be inside of.
  const { error: resetError } = await supabase
    .from("change_orders")
    .update({ is_covered: false, is_paid: false })
    .eq("subcontractor_id", id);

  if (resetError) return fail(resetError.message);
  return ok();
}

export async function deleteSub(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("subcontractors").delete().eq("id", id);

  if (error) return fail(error.message);
  return ok();
}

// ---------------------------------------------------------------- change orders

export async function createChangeOrder(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const subId = String(formData.get("subcontractor_id") ?? "");
  const description = text(formData.get("description"));
  const amount = num(formData.get("amount"));

  if (!subId) return fail("Missing subcontractor.");
  if (!description) return fail("Describe the added scope.");
  if (amount == null) return fail("Enter the change order amount.");

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("change_orders").insert({
    user_id: user.id,
    subcontractor_id: subId,
    description,
    amount,
  });

  if (error) return fail(error.message);
  return ok();
}

/**
 * Ticking a change order raised after the sub was settled adds it on top of the
 * paid amount — the only way that scope reaches the total, short of re-entering
 * the whole paid figure.
 */
export async function setChangeOrderPaid(id: string, isPaid: boolean): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("change_orders").update({ is_paid: isPaid }).eq("id", id);

  if (error) return fail(error.message);
  return ok();
}

export async function deleteChangeOrder(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("change_orders").delete().eq("id", id);

  if (error) return fail(error.message);
  return ok();
}

// ---------------------------------------------------------------- tasks

export async function createTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const phaseId = String(formData.get("phase_id") ?? "");
  const title = text(formData.get("title"));
  if (!phaseId) return fail("Missing phase.");
  if (!title) return fail("Give the task a name.");

  const { supabase, user } = await requireUser();

  const { data: last } = await supabase
    .from("tasks")
    .select("position")
    .eq("phase_id", phaseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    phase_id: phaseId,
    title,
    priority: (text(formData.get("priority")) ?? "medium") as Priority,
    target_date: text(formData.get("target_date")),
    // Optional — "call Bob" costs nothing and should never touch the total.
    price: num(formData.get("price")),
    position: (last?.position ?? -1) + 1,
  });

  if (error) return fail(error.message);
  return ok();
}

export async function updateTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const title = text(formData.get("title"));
  if (!id) return fail("Missing task.");
  if (!title) return fail("Give the task a name.");

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      priority: (text(formData.get("priority")) ?? "medium") as Priority,
      target_date: text(formData.get("target_date")),
      completed_date: text(formData.get("completed_date")),
      price: num(formData.get("price")),
    })
    .eq("id", id);

  if (error) return fail(error.message);
  return ok();
}

/** Spec §4: checking a task off asks when it was finished. */
export async function completeTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const completedDate = text(formData.get("completed_date"));
  if (!id) return fail("Missing task.");
  if (!completedDate) return fail("Enter the completed date.");

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("tasks")
    .update({ is_complete: true, completed_date: completedDate })
    .eq("id", id);

  if (error) return fail(error.message);
  return ok();
}

export async function uncompleteTask(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("tasks")
    .update({ is_complete: false, completed_date: null })
    .eq("id", id);

  if (error) return fail(error.message);
  return ok();
}

/**
 * Spec §4: dragging saves a new manual order and flips the phase back to manual
 * sort, where it stays until the user picks priority or price again.
 */
export async function reorderTasks(phaseId: string, orderedIds: string[]): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from("tasks").update({ position: index }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return fail(failed.error.message);

  const { error } = await supabase.from("phases").update({ task_sort: "manual" }).eq("id", phaseId);
  if (error) return fail(error.message);

  return ok();
}

export async function setTaskSort(phaseId: string, sort: TaskSort): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("phases").update({ task_sort: sort }).eq("id", phaseId);

  if (error) return fail(error.message);
  return ok();
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) return fail(error.message);
  return ok();
}

// ---------------------------------------------------------------- report

export async function setBestOffer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const amount = num(formData.get("best_offer"));
  const { supabase, project } = await getOrCreateProject();

  const { error } = await supabase
    .from("projects")
    .update({ best_offer: amount })
    .eq("id", project.id);

  if (error) return fail(error.message);
  return ok();
}
