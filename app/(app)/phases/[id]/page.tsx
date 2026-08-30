import Link from "next/link";
import { notFound } from "next/navigation";
import { Divider } from "@/components/chrome";
import { PhaseHeader } from "@/components/phases/phase-header";
import { SubSection } from "@/components/subs/sub-section";
import { TaskSection } from "@/components/tasks/task-section";
import { money, phaseTotals } from "@/lib/costs";
import { loadPhase, signPaths } from "@/lib/data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { phase } = await loadPhase(id);
  return { title: `${phase?.name ?? "Phase"} — House Build Tracker` };
}

export default async function PhasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { phase } = await loadPhase(id);

  if (!phase) notFound();

  const totals = phaseTotals(phase);

  const paths = [
    ...phase.subcontractors.flatMap((s) => s.attachments.map((a) => a.storage_path)),
    ...phase.tasks.flatMap((t) => t.attachments.map((a) => a.storage_path)),
  ];
  const signed = Object.fromEntries(await signPaths(paths));

  return (
    <>
      <div style={{ paddingTop: 32 }}>
        <Link href="/" className="linkbtn">
          ← All phases
        </Link>
      </div>

      <PhaseHeader
        phaseId={phase.id}
        name={phase.name}
        isComplete={phase.is_complete}
        totals={{
          subs: money(totals.subs.actual),
          tasks: money(totals.tasks.actual),
          total: money(totals.total.actual),
          projected:
            totals.total.projected === totals.total.actual
              ? null
              : money(totals.total.projected),
          bid: totals.bid > 0 ? money(totals.bid) : null,
        }}
      />

      <SubSection phaseId={phase.id} subs={phase.subcontractors} signedUrls={signed} />

      <Divider />

      <TaskSection
        phaseId={phase.id}
        tasks={phase.tasks}
        sort={phase.task_sort}
        signedUrls={signed}
      />

      <Divider />
    </>
  );
}
