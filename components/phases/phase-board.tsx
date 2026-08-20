"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deletePhase, reorderPhases, setPhaseComplete } from "@/app/actions/tracker";
import { SortableList, SortableRow } from "@/components/sortable";
import { DeleteButton, useAction } from "@/components/ui";
import { money } from "@/lib/costs";

export interface PhaseSummary {
  id: string;
  name: string;
  isComplete: boolean;
  subCount: number;
  taskCount: number;
  openTaskCount: number;
  total: number;
  bid: number;
}

export function PhaseBoard({ phases }: { phases: PhaseSummary[] }) {
  // Local copy so a drag lands instantly; the server order arrives on revalidate.
  const [order, setOrder] = useState(phases);
  const { run, error } = useAction();

  useEffect(() => setOrder(phases), [phases]);

  if (phases.length === 0) {
    return (
      <div className="empty">
        No phases yet. Add the first one — land purchase, foundation, whatever the build starts
        with.
      </div>
    );
  }

  function handleReorder(nextIds: string[]) {
    const byId = new Map(order.map((p) => [p.id, p]));
    setOrder(nextIds.map((id) => byId.get(id)!).filter(Boolean));
    run(() => reorderPhases(nextIds));
  }

  return (
    <div>
      {error ? <div className="notice">{error}</div> : null}

      <SortableList ids={order.map((p) => p.id)} onReorder={handleReorder}>
        {order.map((phase, index) => (
          <SortableRow key={phase.id} id={phase.id} className="ledger-row">
            {(handle) => <PhaseRow phase={phase} index={index} handle={handle} />}
          </SortableRow>
        ))}
      </SortableList>
    </div>
  );
}

function PhaseRow({
  phase,
  index,
  handle,
}: {
  phase: PhaseSummary;
  index: number;
  handle: React.ReactNode;
}) {
  const { run, pending } = useAction();

  return (
    <>
      <div className="row gap-4" style={{ alignItems: "center" }}>
        {handle}
        <span className="ledger-num">{String(index + 1).padStart(2, "0")}</span>
      </div>

      <div>
        <div className="row gap-12 top">
          <input
            type="checkbox"
            checked={phase.isComplete}
            disabled={pending}
            aria-label={`Mark ${phase.name} complete`}
            onChange={(e) => run(() => setPhaseComplete(phase.id, e.target.checked))}
          />
          <div style={{ minWidth: 0 }}>
            <div className={`ledger-title ${phase.isComplete ? "strike" : ""}`}>
              <Link href={`/phases/${phase.id}`}>{phase.name}</Link>
            </div>
            <div className="ledger-desc">
              {phase.subCount} {phase.subCount === 1 ? "sub" : "subs"} · {phase.taskCount}{" "}
              {phase.taskCount === 1 ? "task" : "tasks"}
              {phase.openTaskCount > 0 ? ` · ${phase.openTaskCount} open` : ""}
            </div>
            <div className="row gap-12" style={{ marginTop: 8 }}>
              <DeleteButton
                onDelete={() => deletePhase(phase.id)}
                label="Delete phase"
                confirmLabel="Delete everything in it?"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="ledger-price">
        <div>{money(phase.total)}</div>
        {phase.bid > 0 ? <div className="micro">{money(phase.bid)} bid</div> : null}
        {phase.isComplete ? <div className="micro route">phase closed</div> : null}
      </div>
    </>
  );
}
