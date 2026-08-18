"use client";

import { useActionState } from "react";
import { setBestOffer } from "@/app/actions/tracker";
import { ErrorNote, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/lib/types";

/** Spec §7 / §8: one accepted offer, not a multi-scenario model. */
export function BestOfferForm({ bestOffer }: { bestOffer: number | null }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(setBestOffer, {});

  return (
    <form action={formAction} className="panel row wrapped gap-16" style={{ alignItems: "flex-end" }}>
      <label className="field" style={{ maxWidth: 240, flex: 1 }}>
        <span>Best offer</span>
        <input
          type="number"
          step="0.01"
          min="0"
          name="best_offer"
          defaultValue={bestOffer ?? ""}
          placeholder="0.00"
        />
      </label>

      <SubmitButton className="btn sm">Save offer</SubmitButton>

      {state.ok ? <span className="micro route">saved</span> : null}
      <ErrorNote state={state} />
    </form>
  );
}
