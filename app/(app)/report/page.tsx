import { Divider } from "@/components/chrome";
import { BestOfferForm } from "@/components/report/best-offer-form";
import { money, phaseTotals, projectTotal } from "@/lib/costs";
import { loadProject } from "@/lib/data";

export const metadata = { title: "Final report — House Build Tracker" };

/**
 * Spec §7: total cost across every phase (land purchase included) against the
 * one best offer, giving profit. Runnable at any time — nothing waits on phases
 * being checked complete.
 */
export default async function ReportPage() {
  const { project, phases } = await loadProject();

  const total = projectTotal(phases);
  const bestOffer = project.best_offer == null ? null : Number(project.best_offer);
  const profit = bestOffer == null ? null : bestOffer - total;
  const openPhases = phases.filter((p) => !p.is_complete).length;

  return (
    <>
      <section style={{ padding: "48px 0 24px" }}>
        <div className="eyebrow">Final report</div>
        <h1 className="page-title">Best offer, minus what the build cost.</h1>
        <p className="sub">
          Run it whenever you like — the total is live. Phases left open just mean more cost may
          still land.
        </p>
      </section>

      <section style={{ padding: "12px 0" }}>
        <div className="stats">
          <div className="stats-note">
            {openPhases > 0
              ? `${openPhases} ${openPhases === 1 ? "phase is" : "phases are"} still open — this total will keep moving`
              : "every phase marked complete"}
          </div>
          <div className="stats-grid">
            <div>
              <div className="stat-num">{money(total)}</div>
              <div className="stat-label">Total cost</div>
            </div>
            <div>
              <div className="stat-num">{bestOffer == null ? "—" : money(bestOffer)}</div>
              <div className="stat-label">Best offer</div>
            </div>
            <div>
              <div className={`stat-num ${profit != null && profit < 0 ? "neg" : ""}`}>
                {profit == null ? "—" : money(profit)}
              </div>
              <div className="stat-label">Profit</div>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="section-head">
          <div className="eyebrow">The one number you enter</div>
          <h2>Best offer on the house</h2>
        </div>
        <BestOfferForm bestOffer={bestOffer} />
      </section>

      <section className="block">
        <div className="section-head">
          <div className="eyebrow">Where the money went</div>
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
                      {money(totals.subs)} subcontractors · {money(totals.tasks)} tasks
                      {phase.is_complete ? " · phase closed" : ""}
                    </div>
                  </div>
                  <div className="ledger-price">{money(totals.total)}</div>
                </div>
              );
            })}

            <div className="ledger-row" style={{ borderBottom: "none" }}>
              <div className="ledger-num" />
              <div className="ledger-title">Total cost</div>
              <div className="ledger-price" style={{ fontSize: 17 }}>
                {money(total)}
              </div>
            </div>
          </>
        )}
      </section>

      <Divider />
    </>
  );
}
