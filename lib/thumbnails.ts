/**
 * Thumbnails for the two formats a browser will not draw on its own: PDF, which
 * needs a renderer, and HEIC, which every phone in the field produces and only
 * Safari can decode. Both are done in the browser, on demand, so nothing has to
 * be generated at upload time and files already in the bucket get thumbnails too.
 *
 * Both libraries are heavy (a few MB each) and are `import()`ed only when a file
 * of that kind actually scrolls into view, so neither reaches the main bundle.
 */

const MAX_EDGE = 560;

/**
 * What a receipt is downscaled to before it is sent off to be read. The API
 * resamples anything longer than this anyway, and the small print on a till
 * roll needs every pixel up to it.
 */
const READABLE_EDGE = 1568;

export interface Thumbnail {
  /**
   * The rendered picture as an object URL, or null if it could not be produced
   * (a corrupt file, an expired signed URL, a PDF that wants a password).
   * Callers fall back to the extension tile — a missing thumbnail is cosmetic.
   */
  url: string | null;
  /** Page count, for a PDF that opened. Null for everything else. */
  pages: number | null;
}

const EMPTY: Thumbnail = { url: null, pages: null };

/** One promise per file, so the grid and the detail sheet share a single decode. */
const cache = new Map<string, Promise<Thumbnail>>();

export type ThumbnailKind = "pdf" | "heic";

export function thumbnailFor(key: string, kind: ThumbnailKind, url: string): Promise<Thumbnail> {
  const existing = cache.get(key);
  if (existing) return existing;

  const pending = (kind === "pdf" ? renderPdfFirstPage(url) : renderHeic(url)).catch(() => EMPTY);
  cache.set(key, pending);
  return pending;
}

/** Scale to fit inside `maxEdge`, never up — a thumbnail of a thumbnail is mush. */
function fit(width: number, height: number, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}

function toObjectUrl(canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), "image/jpeg", 0.82);
  });
}

let workerPort: Worker | null = null;

async function renderPdfFirstPage(url: string): Promise<Thumbnail> {
  const pdfjs = await import("pdfjs-dist");

  // One worker for the whole session. The bundler rewrites this URL to the
  // emitted worker chunk, so there is nothing to copy into /public.
  if (!workerPort) {
    workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), {
      type: "module",
    });
    pdfjs.GlobalWorkerOptions.workerPort = workerPort;
  }

  // Fetched here rather than handed to pdf.js as a URL: one plain GET beats the
  // ranged requests it would otherwise make against a signed storage URL.
  const response = await fetch(url);
  if (!response.ok) return EMPTY;
  const data = new Uint8Array(await response.arrayBuffer());

  const loading = pdfjs.getDocument({ data });
  try {
    const doc = await loading.promise;
    const pages = doc.numPages;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const { width, height, scale } = fit(base.width, base.height);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    await page.render({ canvas, viewport: page.getViewport({ scale }) }).promise;
    return { url: await toObjectUrl(canvas), pages };
  } finally {
    // Frees the page and its fonts; the worker itself is kept for the next file.
    void loading.destroy();
  }
}

/**
 * A HEIC photo as a JPEG data URL, at reading rather than thumbnail size.
 *
 * Receipt extraction needs this because HEIC is the one format nothing else in
 * the chain can open: the API does not decode it and neither does Node, but the
 * browser already carries the decoder for thumbnails — so it converts, and the
 * server gets a JPEG it can pass straight on.
 */
export async function heicAsJpegDataUrl(url: string): Promise<string | null> {
  const bitmap = await decodeHeic(url);
  if (!bitmap) return null;

  try {
    const { width, height } = fit(bitmap.width, bitmap.height, READABLE_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    bitmap.close();
  }
}

async function decodeHeic(url: string): Promise<ImageBitmap | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const blob = await response.blob();

  // The CSP build: same decoder, no eval, so it keeps working if a Content-
  // Security-Policy ever lands in front of this app.
  const { heicTo } = await import("heic-to/csp");
  return heicTo({ blob, type: "bitmap" });
}

async function renderHeic(url: string): Promise<Thumbnail> {
  const bitmap = await decodeHeic(url);
  if (!bitmap) return EMPTY;

  try {
    const { width, height } = fit(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    return { url: await toObjectUrl(canvas), pages: null };
  } finally {
    bitmap.close();
  }
}
