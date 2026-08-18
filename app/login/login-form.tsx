"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn } from "@/app/actions/auth";
import type { ActionResult } from "@/lib/types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(signIn, {});

  return (
    <form action={formAction} className="panel stack gap-16">
      <input type="hidden" name="next" value={next} />

      <label className="field">
        <span>Email</span>
        <input type="email" name="email" autoComplete="username" required autoFocus />
      </label>

      <label className="field">
        <span>Password</span>
        <input type="password" name="password" autoComplete="current-password" required />
      </label>

      {state.error ? <div className="notice">{state.error}</div> : null}

      <SubmitButton />
    </form>
  );
}
