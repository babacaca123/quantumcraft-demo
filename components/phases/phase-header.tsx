"use client";

import { useState } from "react";
import { renamePhase, setPhaseComplete } from "@/app/actions/tracker";
import { useAction } from "@/components/ui";

export function PhaseHeader({
  phaseId,
  name,
  isComplete,
  totals,
}: {
  phaseId: string;
  name: string;
  isComplete: boolean;
  totals: {
    subs: string;
    tasks: string;
    total: string;
    /** Null once everything here is settled and the two figures have met. */
    projected: string | null;
    bid: string | null;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const { run, pending, error } = useAction();

  function commitRename() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== name) run(() => renamePhase(phaseId, draft));
    else setDraft(name);
  }

  return (
    <section style={{ padding: "16px 0 32px" }}>
      <div className="eyebrow">Phase</div>

      <div className="row gap-12 top" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={isComplete}
          disabled={pending}
          aria-label="Mark phase complete"
          style={{ marginTop: 14 }}
          onChange={(e) => run(() => setPhaseComplete(phaseId, e.target.checked))}
        />

        {editing ? (
          <input
            type="text"
            value={draft}
            autoFocus
            style={{ maxWidth: 420, fontSize: 18 }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <h1 className={`page-title ${isComplete ? "strike" : ""}`}>{name}</h1>
        )}

        {!editing ? (
          <button type="button" className="linkbtn" onClick={() => setEditing(true)}>
            Rename
          </button>
        ) : null}
      </div>

      {error ? <div className="notice">{error}</div> : null}

      <div className="panel row wrapped gap-24 spread" style={{ marginTop: 20 }}>
        <Figure label="Subcontractors" value={totals.subs} />
        <Figure label="Tasks" value={totals.tasks} />
        <Figure label="Spent so far" value={totals.total} strong />
        {totals.projected ? <Figure label="Projected" value={totals.projected} /> : null}
        {totals.bid ? <Figure label="Bids on record" value={totals.bid} muted /> : null}
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div
        className="mono"
        style={{
          fontSize: strong ? 22 : 17,
          marginTop: 2,
          color: muted ? "var(--slate)" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}
