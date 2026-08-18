import { Divider } from "@/components/chrome";
import { FileBrowser } from "@/components/attachments/file-browser";
import { money } from "@/lib/costs";
import { loadAllFiles } from "@/lib/data";

export const metadata = { title: "All files — House Build Tracker" };

/**
 * Spec §6: one flat list of every file across the whole build, newest added
 * first. Deliberately not foldered by phase — the phase is a detail on the
 * file, not a folder around it.
 */
export default async function FilesPage() {
  const files = await loadAllFiles();
  const confirmedTotal = files
    .filter((f) => f.is_confirmed && f.amount != null)
    .reduce((sum, f) => sum + Number(f.amount), 0);

  return (
    <>
      <section style={{ padding: "48px 0 8px" }}>
        <h1 className="page-title">All files</h1>
      </section>

      <section className="block">
        <div className="section-head row spread wrapped gap-16">
          <div className="label">
            {files.length} {files.length === 1 ? "file" : "files"}, newest first
          </div>
          <div className="mono">{money(confirmedTotal)} confirmed</div>
        </div>

        {files.length === 0 ? (
          <div className="empty">
            Nothing uploaded yet. Attach files from any subcontractor or task inside a phase.
          </div>
        ) : (
          <FileBrowser files={files} />
        )}
      </section>

      <Divider />
    </>
  );
}
