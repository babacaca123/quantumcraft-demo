import { Divider } from "@/components/chrome";
import { BestOfferForm } from "@/components/report/best-offer-form";
import { money, phaseTotals, projectTotal } from "@/lib/costs";
import { loadProject } from "@/lib/data";

export const metadata = { title: "Final report — House Build Tracker" };

/**
 * Spec §7: total cost across every phase (land purchase included) against the
 * one best offer, giving profit. Runnable at any time — nothing waits on phases
 * being checked complete.
 *
 * Profit is struck against what has actually been spent, never the projection.
 * A projected profit is a guess wearing the same clothes as a fact, and this
 * page is the one place in the app where the two must not be confusable.
 */
export default async function ReportPage() {
  const { project, phases } = await loadProject();

  const total = projectTotal(phases);
  const bestOffer = project.best_offer == null ? null : Number(project.best_offer);
  const profit = bestOffer == null ? null : bestOffer - total.actual;
  const openPhases = phases.filter((p) => !p.is_complete).length;

  return (
    <>
      <section style={{ padding: "48px 0 24px" }}>
        <h1 className="page-title">Final report</h1>
      </section>

      <section style={{ padding: "12px 0" }}>
        <div className="stats">
          <div className="stats-note">
            {openPhases > 0
              ? `${openPhases} of ${phases.length} phases still open`
              : "every phase complete"}
          </div>
          <div className="stats-grid">
            <div>
              <div className="stat-num">{money(total.actual)}</div>
              <div className="stat-label">Spent so far</div>
              <div className="stat-sub">{money(total.projected)} projected</div>
            </div>
            <div>
              <div className="stat-num">{bestOffer == null ? "—" : money(bestOffer)}</div>
              <div className="stat-label">Best offer</div>
            </div>
            <div>
              <div className={`stat-num ${profit != null && profit < 0 ? "neg" : ""}`}>
                {profit == null ? "—" : money(profit)}
              </div>
              <div className="stat-label">Profit on spend</div>
              <div className="stat-sub">against what has gone out, not the projection</div>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="section-head">
          <h2>Best offer on the house</h2>
        </div>
        <BestOfferForm bestOffer={bestOffer} />
      </section>

      <section className="block">
        <div className="section-head">
          <h2>Cost by phase</h2>
        </div>

        {phases.length === 0 ? (
          <div className="empty">No phases yet, so nothing to total.</div>
        ) : (
          <>
            {phases.map((phase, index) => {
              const totals = phaseTotals(phase);
              return (
                <div key={phase.id} className="ledger-row">
                  <div className="ledger-num">{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <div className="ledger-title">{phase.name}</div>
                    <div className="ledger-desc">
                      {money(totals.subs.actual)} subcontractors · {money(totals.tasks.actual)}{" "}
                      tasks
                      {phase.is_complete ? " · phase closed" : ""}
                    </div>
                  </div>
                  <div className="ledger-price">
                    <div>{money(totals.total.actual)}</div>
                    {totals.total.projected !== totals.total.actual ? (
                      <div className="micro">{money(totals.total.projected)} projected</div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <div className="ledger-row" style={{ borderBottom: "none" }}>
              <div className="ledger-num" />
              <div className="ledger-title">Spent so far</div>
              <div className="ledger-price" style={{ fontSize: 17 }}>
                <div>{money(total.actual)}</div>
                {total.projected !== total.actual ? (
                  <div className="micro">{money(total.projected)} projected</div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>

      <Divider />
    </>
  );
}
