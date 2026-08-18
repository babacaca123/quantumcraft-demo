"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteAttachment } from "@/app/actions/files";
import { ReceiptEditDialog } from "@/components/attachments/receipt-dialog";
import { DeleteButton } from "@/components/ui";
import type { Attachment } from "@/lib/types";

/** Edit / remove / jump-to-phase for one row of the All Files list. */
export function FileRowActions({ file }: { file: Attachment & { phase_name: string } }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="row gap-16 wrapped" style={{ marginTop: 8 }}>
      <button type="button" className="linkbtn" onClick={() => setEditing(true)}>
        Edit receipt
      </button>
      <Link href={`/phases/${file.phase_id}`} className="linkbtn">
        Go to phase
      </Link>
      <DeleteButton onDelete={() => deleteAttachment(file.id)} label="Remove" />

      <ReceiptEditDialog file={editing ? file : null} onClose={() => setEditing(false)} />
    </div>
  );
}
