"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/types";

/**
 * Native <dialog> wrapper. Using the platform element means backdrop, focus trap
 * and Escape all come for free, and it takes its styling from the `dialog` rules
 * in globals.css.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} onCancel={onClose} onClose={onClose}>
      <div className="dialog-body">
        <div className="dialog-head">
          <div className="eyebrow">{title}</div>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/**
 * Closes a dialog when its action reports a *fresh* success.
 *
 * useActionState keeps the last result for as long as the component is mounted,
 * and these dialogs stay mounted while closed — so after one successful add the
 * state reads `{ ok: true }` forever. Watching `state.ok` alone therefore slams
 * the dialog shut the instant it is reopened, which is why a second sub or task
 * could never be added: the form flashed and vanished before it could be typed
 * into. Comparing object identity against the result present when the dialog
 * opened means only a result that actually arrived during *this* visit counts.
 */
export function useCloseOnSuccess(state: ActionResult, open: boolean, close: () => void) {
  const atOpen = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (!open) {
      atOpen.current = null;
      return;
    }
    if (atOpen.current === null) {
      atOpen.current = state;
      return;
    }
    if (state !== atOpen.current && state.ok) close();
  }, [state, open, close]);
}

/** Submit button that reports the enclosing form's pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

export function ErrorNote({ state }: { state: ActionResult }) {
  if (!state.error) return null;
  return <div className="notice">{state.error}</div>;
}

/**
 * Fires a server action that takes plain arguments (toggles, deletes, reorders)
 * and surfaces any error inline rather than throwing it away.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return { run, pending, error, clearError: () => setError(null) };
}

/** A destructive action behind a click-to-confirm, so no browser confirm() blocks. */
export function DeleteButton({
  onDelete,
  label = "Delete",
  confirmLabel = "Confirm?",
}: {
  onDelete: () => Promise<ActionResult>;
  label?: string;
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { run, pending } = useAction();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      className="linkbtn warn"
      disabled={pending}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        run(onDelete);
      }}
    >
      {pending ? "…" : armed ? confirmLabel : label}
    </button>
  );
}

export function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  return <span className={`badge ${priority}`}>{priority}</span>;
}
