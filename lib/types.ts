export type Priority = "high" | "medium" | "low";
export type TaskSort = "manual" | "priority" | "price";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  best_offer: number | null;
  created_at: string;
}

export interface Phase {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  position: number;
  is_complete: boolean;
  task_sort: TaskSort;
  created_at: string;
}

export interface Subcontractor {
  id: string;
  user_id: string;
  phase_id: string;
  name: string;
  company: string | null;
  phone: string | null;
  bid_price: number | null;
  is_favorite: boolean;
  is_complete: boolean;
  paid_amount: number | null;
  position: number;
  created_at: string;
}

export interface ChangeOrder {
  id: string;
  user_id: string;
  subcontractor_id: string;
  description: string;
  amount: number;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  phase_id: string;
  title: string;
  priority: Priority;
  target_date: string | null;
  completed_date: string | null;
  price: number | null;
  is_complete: boolean;
  position: number;
  created_at: string;
}

export interface Attachment {
  id: string;
  user_id: string;
  project_id: string;
  phase_id: string;
  subcontractor_id: string | null;
  task_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  /** Only a receipt carries a price. v2 sets this by extraction; v1 by a tick. */
  is_receipt: boolean;
  receipt_date: string | null;
  vendor: string | null;
  amount: number | null;
  is_confirmed: boolean;
  created_at: string;
}

/** A sub with everything needed to cost it. */
export interface SubWithDetail extends Subcontractor {
  change_orders: ChangeOrder[];
  attachments: Attachment[];
}

/** A task with everything needed to cost it. */
export interface TaskWithDetail extends Task {
  attachments: Attachment[];
}

export interface PhaseWithDetail extends Phase {
  subcontractors: SubWithDetail[];
  tasks: TaskWithDetail[];
}

/** Result shape returned by every server action, consumed by useActionState. */
export interface ActionResult {
  error?: string;
  ok?: boolean;
  /** id of the row just created, so the caller can follow up on it. */
  id?: string;
}
