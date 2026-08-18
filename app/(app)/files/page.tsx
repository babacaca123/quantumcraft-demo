import { Divider } from "@/components/chrome";
import { FileRowActions } from "@/components/attachments/file-row-actions";
import { formatBytes, formatDate, formatTimestamp, money } from "@/lib/costs";
import { loadAllFiles } from "@/lib/data";

export const metadata = { title: "All files — House Build Tracker" };

/**
 * Spec §6: one flat list of every file across the whole build, newest added
 * first. Deliberately not foldered by phase — the phase is just a column.
 */
export default async function FilesPage() {
  const files = await loadAllFiles();
  const confirmedTotal = files
    .filter((f) => f.is_confirmed && f.amount != null)
    .reduce((sum, f) => sum + Number(f.amount), 0);

  return (
    <>
      <section style={{ padding: "48px 0 24px" }}>
        <div className="eyebrow">Everything attached</div>
        <h1 className="page-title">All files, newest first.</h1>
        <p className="sub">
          Receipts, photos, plans, checks — across every phase. Confirmed receipt amounts are the
          ones overriding hand-entered costs.
        </p>
      </section>

      <section className="block">
        <div className="section-head row spread wrapped gap-16">
          <div>
            <div className="eyebrow">
              {files.length} {files.length === 1 ? "file" : "files"}
            </div>
            <h2>The paper trail</h2>
          </div>
          <div className="mono">{money(confirmedTotal)} confirmed</div>
        </div>

        {files.length === 0 ? (
          <div className="empty">
            Nothing uploaded yet. Attach files from any subcontractor or task inside a phase.
          </div>
        ) : (
          <>
            <div className="filegrid label" style={{ paddingBottom: 8 }}>
              <div>Added</div>
              <div>File</div>
              <div>Phase</div>
              <div style={{ textAlign: "right" }}>Amount</div>
            </div>

            {files.map((file) => (
              <div key={file.id} className="filegrid">
                <div className="micro">{formatTimestamp(file.created_at)}</div>

                <div>
                  <div className="item-name" style={{ fontSize: 15 }}>
                    {file.signed_url ? (
                      <a
                        href={file.signed_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "inherit" }}
                      >
                        {file.file_name}
                      </a>
                    ) : (
                      file.file_name
                    )}
                  </div>
                  <div className="item-meta">
                    <span>on {file.attached_to}</span>
                    {file.vendor ? <span>{file.vendor}</span> : null}
                    {file.receipt_date ? <span>{formatDate(file.receipt_date)}</span> : null}
                    <span>{formatBytes(file.size_bytes)}</span>
                  </div>
                  <FileRowActions file={file} />
                </div>

                <div className="mono">{file.phase_name}</div>

                <div className="item-amounts">
                  <div>{file.amount != null ? money(file.amount) : "—"}</div>
                  {file.amount != null ? (
                    <div className={`micro ${file.is_confirmed ? "route" : "rust"}`}>
                      {file.is_confirmed ? "confirmed" : "unconfirmed"}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </>
        )}
      </section>

      <Divider />
    </>
  );
}
