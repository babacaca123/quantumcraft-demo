"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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

/** The most sheets a fanned PDF shows. Past this, the rest hide behind the pile. */
const MAX_SHEETS = 4;

function thumbnailKind(file: ThumbFile): ThumbnailKind | null {
  if (isPdf(file.mime_type, file.file_name)) return "pdf";
  if (isHeic(file.mime_type, file.file_name)) return "heic";
  return null;
}

/**
 * The picture for a file, plus its page count when it is a PDF.
 *
 * Lazy by default: rendering starts only once the returned ref's node is on
 * screen, so a page of forty files does not decode forty of them up front. Pass
 * `lazy: false` where there is nothing to observe — inside a dialog that is
 * already open, say.
 *
 * Several components in one tree may call this for the same file; lib/thumbnails
 * caches one promise per file, so they share a single decode between them.
 */
export function useThumbnail(file: ThumbFile, signedUrl: string | null, lazy = true) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [rendered, setRendered] = useState<{
    url: string | null;
    pages: number | null;
  }>({
    url: null,
    pages: null,
  });
  const [rendering, setRendering] = useState(false);
  const kind = thumbnailKind(file);

  useEffect(() => {
    if (!kind || !signedUrl) return;

    let cancelled = false;
    const start = () => {
      setRendering(true);
      thumbnailFor(file.storage_path, kind, signedUrl).then((result) => {
        if (cancelled) return;
        setRendered(result);
        setRendering(false);
      });
    };

    if (!lazy) {
      start();
      return () => {
        cancelled = true;
      };
    }

    const node = ref.current;
    if (!node) return;

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
  }, [kind, signedUrl, lazy, file.storage_path]);

  const direct = isImage(file.mime_type, file.file_name) ? signedUrl : null;

  return {
    ref,
    /** What to draw: the file's own URL for a plain image, else what we rendered. */
    src: direct ?? rendered.url,
    pages: rendered.pages,
    rendering,
  };
}

/** "12 pages" — only ever known for a PDF, and only once it has been opened. */
export function pageLabel(pages: number | null): string | null {
  if (!pages) return null;
  return `${pages} ${pages === 1 ? "page" : "pages"}`;
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
  const { ref, src, pages, rendering } = useThumbnail(file, signedUrl);

  // A multi-page PDF is drawn as a pile: the rendered first page in front, one
  // blank sheet behind for each further page, capped so a 200-page set does not
  // become a fan of 200. They spread on hover — see .filestack in globals.css.
  const sheets = pages && pages > 1 ? Math.min(pages, MAX_SHEETS) - 1 : 0;

  const face = src ? (
    <span className="thumb" style={{ width: size, height: size }}>
      {/* A one-hour signed URL on a private bucket, or a locally rendered blob —
          neither is a candidate for next/image's optimiser, which would need the
          host allow-listed and would cache a URL that expires. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={file.file_name} loading="lazy" />
    </span>
  ) : (
    <span
      ref={ref}
      className={`thumb glyph ${isPdf(file.mime_type, file.file_name) ? "pdf" : ""} ${
        rendering ? "working" : ""
      }`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {rendering ? "…" : fileExtension(file.file_name)}
    </span>
  );

  if (sheets === 0) return face;

  return (
    <span className="filestack" style={{ width: size, height: size }}>
      {Array.from({ length: sheets }, (_, i) => (
        <span
          key={i}
          className="sheet"
          style={{ "--i": i + 1 } as CSSProperties}
          aria-hidden="true"
        />
      ))}
      {face}
    </span>
  );
}

/**
 * The file at full width in the detail sheet: its own shape, a hairline around
 * it, corners rounded just enough to sit on the sheet. Clicking it opens the
 * original — which is why there is no separate "open" button anywhere near it.
 */
export function FileStage({ file, signedUrl }: { file: ThumbFile; signedUrl: string | null }) {
  const { ref, src, rendering } = useThumbnail(file, signedUrl, false);

  const body = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="filestage-img" src={src} alt={file.file_name} />
  ) : (
    <span
      ref={ref}
      className={`thumb glyph ${isPdf(file.mime_type, file.file_name) ? "pdf" : ""} ${
        rendering ? "working" : ""
      }`}
      style={{ width: 160, height: 160 }}
      aria-hidden="true"
    >
      {rendering ? "…" : fileExtension(file.file_name)}
    </span>
  );

  if (!signedUrl) return <div className="filestage">{body}</div>;

  return (
    <a
      className="filestage"
      href={signedUrl}
      target="_blank"
      rel="noreferrer"
      title="Open original"
    >
      {body}
    </a>
  );
}

/** Thumbnail plus name / kind / size, used at the top of the receipt dialog. */
export function FilePreview({ file, signedUrl }: { file: Attachment; signedUrl: string | null }) {
  const { pages } = useThumbnail(file, signedUrl, false);
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
          {pageLabel(pages) ? <span className="pagecount">{pageLabel(pages)}</span> : null}
        </div>
        <div className="item-meta">
          <span>{fileKind(file.mime_type, file.file_name)}</span>
          <span>{formatBytes(file.size_bytes)}</span>
        </div>
      </div>
    </div>
  );
}
