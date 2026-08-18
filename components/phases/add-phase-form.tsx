"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPhase } from "@/app/actions/tracker";
import { ErrorNote, Modal, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/lib/types";

/**
 * Spec §2: phases are fully custom — the user names and orders them freely,
 * with no fixed list and no locked sequence.
 */
export function AddPhaseForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult, FormData>(createPhase, {});
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) wasOpen.current = true;
    if (wasOpen.current && state.ok) setOpen(false);
  }, [state, open]);

  return (
    <>
      <button type="button" className="btn sm" onClick={() => setOpen(true)}>
        + Add phase
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New phase"
        hint="foundation, framing, land purchase — whatever you call it"
      >
        <form action={formAction} className="stack gap-16">
          <label className="field">
            <span>Phase name</span>
            <input type="text" name="name" required autoFocus placeholder="Foundation" />
          </label>

          <ErrorNote state={state} />

          <div className="dialog-foot">
            <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <SubmitButton className="btn sm" pendingLabel="Adding…">
              Add phase
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
