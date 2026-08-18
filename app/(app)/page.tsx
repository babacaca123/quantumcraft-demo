import { Divider } from "@/components/chrome";
import { AddPhaseForm } from "@/components/phases/add-phase-form";
import { PhaseBoard, type PhaseSummary } from "@/components/phases/phase-board";
import { money, phaseTotals, projectTotal } from "@/lib/costs";
import { loadProject } from "@/lib/data";

export const metadata = { title: "Phases — House Build Tracker" };

export default async function PhasesPage() {
  const { phases } = await loadProject();

  const summaries: PhaseSummary[] = phases.map((phase) => {
    const totals = phaseTotals(phase);
    return {
      id: phase.id,
      name: phase.name,
      isComplete: phase.is_complete,
      subCount: phase.subcontractors.length,
      taskCount: phase.tasks.length,
      openTaskCount: phase.tasks.filter((t) => !t.is_complete).length,
      total: totals.total,
      bid: totals.bid,
    };
  });

  const total = projectTotal(phases);
  const completedPhases = phases.filter((p) => p.is_complete).length;
  const openTasks = phases.reduce(
    (sum, p) => sum + p.tasks.filter((t) => !t.is_complete).length,
    0,
  );

  return (
    <>
      <section style={{ padding: "48px 0 8px" }}>
        <div className="eyebrow">Owner-builder ledger</div>
        <h1 className="page-title">Every phase of the build, and what it has cost so far.</h1>
        <p className="sub">
          Costs count the moment you enter them. Receipts are an override, not a gate — attach one
          later and confirm it to correct the number.
        </p>
      </section>

      <section style={{ padding: "24px 0" }}>
        <div className="stats">
          <div className="stats-note">running totals across every phase, including land purchase</div>
          <div className="stats-grid">
            <div>
              <div className="stat-num">{money(total)}</div>
              <div className="stat-label">Total cost to date</div>
            </div>
            <div>
              <div className="stat-num">
                {completedPhases}/{phases.length}
              </div>
              <div className="stat-label">Phases marked complete</div>
            </div>
            <div>
              <div className="stat-num">{openTasks}</div>
              <div className="stat-label">Tasks still open</div>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="section-head row spread wrapped gap-16">
          <div>
            <div className="eyebrow">The build</div>
            <h2>Phases, in your order</h2>
          </div>
          <AddPhaseForm />
        </div>

        <PhaseBoard phases={summaries} />
      </section>

      <Divider />
    </>
  );
}
