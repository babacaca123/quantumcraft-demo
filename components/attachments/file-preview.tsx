"use client";

import { useEffect, useRef, useState } from "react";
import { fileExtension, fileKind, isHeic, isImage, isPdf, shortName } from "@/lib/files";
import { thumbnailFor, type ThumbnailKind } from "@/lib/thumbnails";
import { formatBytes } from "@/lib/costs";
import type { Attachment } from "@/lib/types";

/**
 * Seeing the file, not just its name. Plain images come straight off the signed
 * URL; PDFs and HEICs are rendered in the browser (see lib/thumbnails); anything
 * else falls back to a tile carrying its extension, which is enough to tell a
 * plan set from a signed contract at a glance.
 */

type ThumbFile = Pick<Attachment, "file_name" | "mime_type" | "storage_path">;

function thumbnailKind(file: ThumbFile): ThumbnailKind | null {
  if (isPdf(file.mime_type, file.file_name)) return "pdf";
  if (isHeic(file.mime_type, file.file_name)) return "heic";
  return null;
}

/**
 * Renders a PDF or HEIC to a picture, but only once the tile is actually on
 * screen — a page of forty files should not decode forty of them up front.
 * Returns the ref to attach, the finished URL, and whether work is in flight.
 */
function useRenderedThumbnail(file: ThumbFile, signedUrl: string | null) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const kind = thumbnailKind(file);

  useEffect(() => {
    const node = ref.current;
    if (!kind || !signedUrl || !node) return;

    let cancelled = false;
    const start = () => {
      setRendering(true);
      thumbnailFor(file.storage_path, kind, signedUrl).then((result) => {
        if (cancelled) return;
        setUrl(result);
        setRendering(false);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [kind, signedUrl, file.storage_path]);

  return { ref, url, rendering, needsRender: Boolean(kind) };
}

/** Small square thumbnail — the unit the file grid and the attachment rows share. */
export function FileThumb({
  file,
  signedUrl,
  size = 92,
}: {
  file: ThumbFile;
  signedUrl: string | null;
  size?: number;
}) {
  const rendered = useRenderedThumbnail(file, signedUrl);
  const direct = isImage(file.mime_type, file.file_name) ? signedUrl : null;
  const src = direct ?? rendered.url;

  if (src) {
    return (
      <span className="thumb" style={{ width: size, height: size }}>
        {/* A one-hour signed URL on a private bucket, or a locally rendered
            blob — neither is a candidate for next/image's optimiser, which
            would need the host allow-listed and would cache a URL that expires. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={file.file_name} loading="lazy" />
      </span>
    );
  }

  return (
    <span
      ref={rendered.ref}
      className={`thumb glyph ${isPdf(file.mime_type, file.file_name) ? "pdf" : ""} ${
        rendered.rendering ? "working" : ""
      }`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {rendered.rendering ? "…" : fileExtension(file.file_name)}
    </span>
  );
}

/**
 * The file at full width in the detail sheet: its own shape, no frame around it,
 * corners rounded just enough to sit on the sheet. Clicking it opens the
 * original — which is why there is no separate "open" button anywhere near it.
 */
export function FileStage({ file, signedUrl }: { file: ThumbFile; signedUrl: string | null }) {
  const rendered = useRenderedThumbnail(file, signedUrl);
  const direct = isImage(file.mime_type, file.file_name) ? signedUrl : null;
  const src = direct ?? rendered.url;

  const body = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="filestage-img" src={src} alt={file.file_name} />
  ) : (
    <span
      ref={rendered.ref}
      className={`thumb glyph ${isPdf(file.mime_type, file.file_name) ? "pdf" : ""} ${
        rendered.rendering ? "working" : ""
      }`}
      style={{ width: 160, height: 160 }}
      aria-hidden="true"
    >
      {rendered.rendering ? "…" : fileExtension(file.file_name)}
    </span>
  );

  if (!signedUrl) return <div className="filestage">{body}</div>;

  return (
    <a className="filestage" href={signedUrl} target="_blank" rel="noreferrer" title="Open original">
      {body}
    </a>
  );
}

/** Thumbnail plus name / kind / size, used at the top of the receipt dialog. */
export function FilePreview({
  file,
  signedUrl,
}: {
  file: Attachment;
  signedUrl: string | null;
}) {
  const thumb = <FileThumb file={file} signedUrl={signedUrl} size={80} />;

  return (
    <div className="filepreview">
      {signedUrl ? (
        <a href={signedUrl} target="_blank" rel="noreferrer" title="Open original">
          {thumb}
        </a>
      ) : (
        thumb
      )}
      <div style={{ minWidth: 0 }}>
        <div className="item-name" title={file.file_name}>
          {shortName(file.file_name, 34)}
        </div>
        <div className="item-meta">
          <span>{fileKind(file.mime_type, file.file_name)}</span>
          <span>{formatBytes(file.size_bytes)}</span>
        </div>
      </div>
    </div>
  );
}
