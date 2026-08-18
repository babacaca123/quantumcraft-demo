"use client";

import { fileExtension, fileKind, isImage, isPdf, shortName } from "@/lib/files";
import { formatBytes } from "@/lib/costs";
import type { Attachment } from "@/lib/types";

/**
 * Seeing the file, not just its name. Images render straight from the signed
 * URL; anything else gets a tile carrying its extension, which is enough to
 * tell a plan set from a signed contract at a glance.
 */

/** Small square thumbnail — the unit the file grid and the attachment rows share. */
export function FileThumb({
  file,
  signedUrl,
  size = 92,
}: {
  file: Pick<Attachment, "file_name" | "mime_type">;
  signedUrl: string | null;
  size?: number;
}) {
  const image = isImage(file.mime_type, file.file_name);

  if (image && signedUrl) {
    return (
      <span className="thumb" style={{ width: size, height: size }}>
        {/* A one-hour signed URL on a private bucket — not a candidate for
            next/image's optimiser, which would need the host allow-listed and
            would cache a URL that expires. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={signedUrl} alt={file.file_name} loading="lazy" />
      </span>
    );
  }

  return (
    <span
      className={`thumb glyph ${isPdf(file.mime_type, file.file_name) ? "pdf" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {fileExtension(file.file_name)}
    </span>
  );
}

/** Thumbnail plus name / kind / size, used at the top of the details dialog. */
export function FilePreview({
  file,
  signedUrl,
}: {
  file: Attachment;
  signedUrl: string | null;
}) {
  return (
    <div className="filepreview">
      <FileThumb file={file} signedUrl={signedUrl} size={80} />
      <div style={{ minWidth: 0 }}>
        <div className="item-name" title={file.file_name}>
          {shortName(file.file_name, 34)}
        </div>
        <div className="item-meta">
          <span>{fileKind(file.mime_type, file.file_name)}</span>
          <span>{formatBytes(file.size_bytes)}</span>
        </div>
        {signedUrl ? (
          <a
            className="linkbtn"
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            style={{ marginTop: 8 }}
          >
            Open full size
          </a>
        ) : null}
      </div>
    </div>
  );
}
