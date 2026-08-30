"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createTask,
  deleteTask,
  reorderTasks,
  setTaskSort,
  uncompleteTask,
  updateTask,
} from "@/app/actions/tracker";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
import { SortableList, SortableRow } from "@/components/sortable";
import { CompleteTaskDialog } from "@/components/tasks/complete-task-dialog";
import {
  DeleteButton,
  ErrorNote,
  Modal,
  PriorityBadge,
  SubmitButton,
  useAction,
  useCloseOnSuccess,
} from "@/components/ui";
import { formatDate, money, moneyOrDash, taskCost } from "@/lib/costs";
import type { ActionResult, TaskSort, TaskWithDetail } from "@/lib/types";

const SORT_LABELS: Record<TaskSort, string> = {
  manual: "Manual order",
  priority: "Priority",
  price: "Price",
};

export function TaskSection({
  phaseId,
  tasks,
  sort,
  signedUrls,
}: {
  phaseId: string;
  tasks: TaskWithDetail[];
  sort: TaskSort;
  signedUrls: Record<string, string>;
}) {
  const [adding, setAdding] = useState(false);
  const [order, setOrder] = useState(tasks);
  const { run, error } = useAction();

  useEffect(() => setOrder(tasks), [tasks]);

  /**
   * Spec §4: dragging saves a new manual order that persists until the user
   * picks a different sort mode, so a drag also switches the phase back to
   * manual — otherwise the new order would be invisible under a sorted view.
   */
  function handleReorder(nextIds: string[]) {
    const byId = new Map(order.map((t) => [t.id, t]));
    setOrder(nextIds.map((id) => byId.get(id)!).filter(Boolean));
    run(() => reorderTasks(phaseId, nextIds));
  }

  return (
    <section className="block">
      <div className="section-head row spread wrapped gap-16">
        <h2>Tasks</h2>

        <div className="row gap-12">
          <label className="row gap-8">
            <span className="label">Sort</span>
            <select
              value={sort}
              style={{ width: 150 }}
              onChange={(e) => run(() => setTaskSort(phaseId, e.target.value as TaskSort))}
            >
              {(Object.keys(SORT_LABELS) as TaskSort[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="iconbtn" aria-label="Add task" onClick={() => setAdding(true)}>
            +
          </button>
        </div>
      </div>

      {error ? <div className="notice">{error}</div> : null}

      {sort !== "manual" ? (
        <div className="micro" style={{ marginBottom: 12 }}>
          drag to save a manual order
        </div>
      ) : null}

      {order.length === 0 ? (
        <div className="empty">No tasks on this phase yet.</div>
      ) : (
        <SortableList ids={order.map((t) => t.id)} onReorder={handleReorder}>
          {order.map((task) => (
            <SortableRow key={task.id} id={task.id} className="item">
              {(handle) => (
                <TaskRow task={task} phaseId={phaseId} handle={handle} signedUrls={signedUrls} />
              )}
            </SortableRow>
          ))}
        </SortableList>
      )}

      <TaskDialog phaseId={phaseId} open={adding} onClose={() => setAdding(false)} />
    </section>
  );
}

function TaskRow({
  task,
  phaseId,
  handle,
  signedUrls,
}: {
  task: TaskWithDetail;
  phaseId: string;
  handle: React.ReactNode;
  signedUrls: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const { run, pending, error } = useAction();

  const cost = taskCost(task);
  const overridden = cost.receiptOverride != null;

  return (
    <>
      <div className="row gap-4" style={{ alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={task.is_complete}
          disabled={pending}
          aria-label={`Mark ${task.title} complete`}
          onChange={(e) => {
            // Checking asks for the completed date (spec §4).
            if (e.target.checked) setCompleting(true);
            else run(() => uncompleteTask(task.id));
          }}
        />
      </div>

      <div style={{ minWidth: 0 }}>
        <div className="row gap-8 wrapped">
          {handle}
          <span className={`item-name ${task.is_complete ? "strike" : ""}`}>{task.title}</span>
          <PriorityBadge priority={task.priority} />
        </div>

        <div className="item-meta">
          <span>target {formatDate(task.target_date)}</span>
          {task.is_complete ? <span>done {formatDate(task.completed_date)}</span> : null}
        </div>

        <AttachmentPanel
          phaseId={phaseId}
          taskId={task.id}
          attachments={task.attachments}
          signedUrls={signedUrls}
        />

        <div className="row gap-16 wrapped" style={{ marginTop: 10 }}>
          <button type="button" className="linkbtn" onClick={() => setEditing(true)}>
            Edit
          </button>
          <DeleteButton onDelete={() => deleteTask(task.id)} label="Delete task" />
        </div>

        {error ? <div className="notice">{error}</div> : null}
      </div>

      <div className="item-amounts">
        {task.price == null && !overridden ? (
          <div className="micro">no cost</div>
        ) : (
          <>
            <div>{moneyOrDash(cost.projected)}</div>
            {overridden ? (
              <>
                <div className="micro rust">from receipts</div>
                {/* What was typed in is untouched underneath; it only earns a
                    line of its own when the receipts disagree with it. */}
                {cost.disagrees && task.price != null ? (
                  <div className="micro superseded">{money(cost.manual)} entered</div>
                ) : null}
              </>
            ) : task.is_complete ? null : (
              // Priced but not done, so the money has not gone anywhere yet —
              // the same thing the sub rows say about an unsettled bid.
              <div className="micro">projected</div>
            )}
          </>
        )}
      </div>

      <TaskDialog phaseId={phaseId} task={task} open={editing} onClose={() => setEditing(false)} />

      <CompleteTaskDialog task={task} open={completing} onClose={() => setCompleting(false)} />
    </>
  );
}

function TaskDialog({
  phaseId,
  task,
  open,
  onClose,
}: {
  phaseId: string;
  task?: TaskWithDetail;
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    task ? updateTask : createTask,
    {},
  );
  useCloseOnSuccess(state, open, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
    >
      <form action={formAction} className="stack gap-16">
        {task ? (
          <input type="hidden" name="id" value={task.id} />
        ) : (
          <input type="hidden" name="phase_id" value={phaseId} />
        )}

        <label className="field">
          <span>Task</span>
          <input
            type="text"
            name="title"
            required
            defaultValue={task?.title ?? ""}
            placeholder="Call Bob about the slab pour"
          />
        </label>

        <div className="formgrid">
          <label className="field">
            <span>Priority</span>
            <select name="priority" defaultValue={task?.priority ?? "medium"}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label className="field">
            <span>Target date</span>
            <input type="date" name="target_date" defaultValue={task?.target_date ?? ""} />
          </label>

          {task ? (
            <label className="field">
              <span>Completed date</span>
              <input type="date" name="completed_date" defaultValue={task?.completed_date ?? ""} />
            </label>
          ) : null}

          <label className="field">
            <span>Price (optional)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="price"
              defaultValue={task?.price ?? ""}
              placeholder="0.00"
            />
          </label>
        </div>

        <ErrorNote state={state} />

        <div className="dialog-foot">
          <button type="button" className="btn ghost sm" onClick={onClose}>
            Cancel
          </button>
          <SubmitButton className="btn sm">{task ? "Save" : "Add task"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
