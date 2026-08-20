"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteAttachment } from "@/app/actions/files";
import {
  FileStage,
  FileThumb,
  pageLabel,
  useThumbnail,
} from "@/components/attachments/file-preview";
import { ReceiptEditDialog } from "@/components/attachments/receipt-dialog";
import { DeleteButton, Modal } from "@/components/ui";
import { formatBytes, formatDate, formatTimestamp, money } from "@/lib/costs";
import { fileKind, shortName } from "@/lib/files";
import type { AttachmentRow } from "@/lib/data";

/**
 * All Files as a file manager rather than a table: a grid of tiles you can
 * recognise on sight. Everything else about a file — where it hangs, what it
 * cost, when it landed — is one click away in the detail sheet, so the grid
 * itself stays quiet.
 */
export function FileBrowser({ files }: { files: AttachmentRow[] }) {
  const [selected, setSelected] = useState<AttachmentRow | null>(null);
  const [editing, setEditing] = useState<AttachmentRow | null>(null);

  return (
    <>
      <div className="filegrid">
        {files.map((file) => (
          <FileTile key={file.id} file={file} onOpen={() => setSelected(file)} />
        ))}
      </div>

      <FileDetail
        file={selected}
        onClose={() => setSelected(null)}
        onEdit={() => {
          setEditing(selected);
          setSelected(null);
        }}
      />

      <ReceiptEditDialog
        file={editing}
        signedUrl={editing?.signed_url ?? null}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function FileTile({ file, onOpen }: { file: AttachmentRow; onOpen: () => void }) {
  // The same cached render the thumbnail uses; this call only wants its page
  // count, which is the one thing about a PDF you cannot tell from the picture.
  const { pages } = useThumbnail(file, file.signed_url);
  const label = pageLabel(pages);

  return (
    <button type="button" className="filetile" onClick={onOpen} title={file.file_name}>
      <FileThumb file={file} signedUrl={file.signed_url} size={104} />
      <span className="filetile-name">
        {shortName(file.file_name, 24)}
        {label ? <span className="pagecount">{label}</span> : null}
      </span>
      {file.is_receipt ? (
        <span className={`badge ${file.is_confirmed ? "done" : "high"}`}>
          {file.amount != null ? money(file.amount) : "receipt"}
        </span>
      ) : null}
    </button>
  );
}

function FileDetail({
  file,
  onClose,
  onEdit,
}: {
  file: AttachmentRow | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <Modal open={Boolean(file)} onClose={onClose} title="File">
      {file ? <FileDetailBody file={file} onClose={onClose} onEdit={onEdit} /> : null}
    </Modal>
  );
}

function FileDetailBody({
  file,
  onClose,
  onEdit,
}: {
  file: AttachmentRow;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { pages } = useThumbnail(file, file.signed_url, false);
  const label = pageLabel(pages);

  return (
    <div className="stack gap-16">
      <FileStage file={file} signedUrl={file.signed_url} />

      <div>
        <div className="item-name" style={{ wordBreak: "break-word" }}>
          {file.file_name}
          {label ? <span className="pagecount">{label}</span> : null}
        </div>
        <div className="item-meta">
          <span>{fileKind(file.mime_type, file.file_name)}</span>
          <span>{formatBytes(file.size_bytes)}</span>
          <span>added {formatTimestamp(file.created_at)}</span>
        </div>
      </div>

      <dl className="deflist">
        <dt>Phase</dt>
        <dd>{file.phase_name}</dd>
        <dt>Attached to</dt>
        <dd>{file.attached_to}</dd>
        {file.is_receipt ? (
          <>
            <dt>Vendor</dt>
            <dd>{file.vendor ?? "—"}</dd>
            <dt>Receipt date</dt>
            <dd>{formatDate(file.receipt_date)}</dd>
            <dt>Amount</dt>
            <dd>
              {file.amount != null ? money(file.amount) : "—"}
              {file.amount != null ? (
                <span className={file.is_confirmed ? "route" : "rust"}>
                  {file.is_confirmed ? " · confirmed" : " · unconfirmed"}
                </span>
              ) : null}
            </dd>
          </>
        ) : null}
      </dl>

      <div className="row gap-8 wrapped">
        <button type="button" className="linkbtn" onClick={onEdit}>
          {file.is_receipt ? "Edit details" : "Mark as receipt"}
        </button>
        <Link href={`/phases/${file.phase_id}`} className="linkbtn">
          Go to phase
        </Link>
        <DeleteButton onDelete={() => deleteAttachment(file.id)} label="Delete" />
      </div>

      <div className="dialog-foot">
        <button type="button" className="btn ghost sm" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
