"use client";

import { useActionState, useEffect, useRef } from "react";
import { completeTask } from "@/app/actions/tracker";
import { ErrorNote, Modal, SubmitButton, useCloseOnSuccess } from "@/components/ui";
import type { ActionResult, TaskWithDetail } from "@/lib/types";

function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Spec §4: checking a task off prompts for the completed date. */
export function CompleteTaskDialog({
  task,
  open,
  onClose,
}: {
  task: TaskWithDetail;
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(completeTask, {});
  useCloseOnSuccess(state, open, onClose);

  return (
    <Modal open={open} onClose={onClose} title={`Complete “${task.title}”`}>
      <form action={formAction} className="stack gap-16">
        <input type="hidden" name="id" value={task.id} />

        <label className="field">
          <span>Completed date</span>
          <input
            type="date"
            name="completed_date"
            required
            autoFocus
            defaultValue={task.completed_date ?? today()}
          />
        </label>

        <ErrorNote state={state} />

        <div className="dialog-foot">
          <button type="button" className="btn ghost sm" onClick={onClose}>
            Cancel
          </button>
          <SubmitButton className="btn sm">Mark complete</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
