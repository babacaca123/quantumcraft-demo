import { getOrCreateProject } from "@/lib/auth";
import type {
  Attachment,
  PhaseWithDetail,
  Project,
  SubWithDetail,
  TaskSort,
  TaskWithDetail,
} from "@/lib/types";

const PHASE_SELECT = `
  *,
  subcontractors ( *, change_orders ( * ), attachments ( * ) ),
  tasks ( *, attachments ( * ) )
`;

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/**
 * Spec §3: a favourite is a per-phase pin, so favourites rise to the top of the
 * phase's sub list and everything else keeps its saved order underneath.
 */
export function sortSubs(subs: SubWithDetail[]): SubWithDetail[] {
  return [...subs].sort(
    (a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.position - b.position,
  );
}

/** Applies a phase's saved sort mode. Manual order is the persisted `position`. */
export function sortTasks(tasks: TaskWithDetail[], mode: TaskSort): TaskWithDetail[] {
  const sorted = [...tasks];

  if (mode === "priority") {
    sorted.sort(
      (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.position - b.position,
    );
  } else if (mode === "price") {
    // Highest spend first; unpriced tasks sink to the bottom.
    sorted.sort((a, b) => Number(b.price ?? -1) - Number(a.price ?? -1) || a.position - b.position);
  } else {
    sorted.sort((a, b) => a.position - b.position);
  }

  return sorted;
}

/** The whole build in one round trip — small enough for a single user, and the
 *  cost rollup needs every attachment anyway. */
export async function loadProject(): Promise<{ project: Project; phases: PhaseWithDetail[] }> {
  const { project, supabase } = await getOrCreateProject();

  const { data, error } = await supabase
    .from("phases")
    .select(PHASE_SELECT)
    .eq("project_id", project.id)
    .order("position", { ascending: true })
    .order("position", { ascending: true, referencedTable: "subcontractors" })
    .order("position", { ascending: true, referencedTable: "tasks" });

  if (error) throw new Error(error.message);

  const phases = (data ?? []) as unknown as PhaseWithDetail[];
  for (const phase of phases) {
    phase.tasks = sortTasks(phase.tasks ?? [], phase.task_sort);
    phase.subcontractors = sortSubs(phase.subcontractors ?? []);
    for (const sub of phase.subcontractors) {
      sub.change_orders = sub.change_orders ?? [];
      sub.attachments = sub.attachments ?? [];
    }
    for (const task of phase.tasks) {
      task.attachments = task.attachments ?? [];
    }
  }

  return { project, phases };
}

export async function loadPhase(phaseId: string): Promise<{
  project: Project;
  phase: PhaseWithDetail | null;
}> {
  const { project, phases } = await loadProject();
  return { project, phase: phases.find((p) => p.id === phaseId) ?? null };
}

export interface AttachmentRow extends Attachment {
  phase_name: string;
  attached_to: string;
  signed_url: string | null;
}

/** Spec §6: one flat list of every file in the build, newest added first. */
export async function loadAllFiles(): Promise<AttachmentRow[]> {
  const { supabase } = await getOrCreateProject();

  const { data, error } = await supabase
    .from("attachments")
    .select("*, phases ( name ), subcontractors ( name ), tasks ( title )")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as (Attachment & {
    phases: { name: string } | null;
    subcontractors: { name: string } | null;
    tasks: { title: string } | null;
  })[];

  const paths = rows.map((r) => r.storage_path);
  const signedByPath = new Map<string, string>();

  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("attachments")
      .createSignedUrls(paths, 60 * 60);
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl);
    }
  }

  return rows.map((row) => ({
    ...row,
    phase_name: row.phases?.name ?? "—",
    attached_to: row.subcontractors?.name ?? row.tasks?.title ?? "—",
    signed_url: signedByPath.get(row.storage_path) ?? null,
  }));
}

/** Short-lived download links for the attachments hanging off one phase. */
export async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;

  const { supabase } = await getOrCreateProject();
  const { data } = await supabase.storage.from("attachments").createSignedUrls(paths, 60 * 60);

  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  }
  return map;
}
