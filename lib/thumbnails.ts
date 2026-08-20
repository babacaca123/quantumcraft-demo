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

/** One promise per file, so the grid and the detail sheet share a single decode. */
const cache = new Map<string, Promise<string | null>>();

export type ThumbnailKind = "pdf" | "heic";

/**
 * The rendered thumbnail as an object URL, or null if it could not be produced
 * (a corrupt file, an expired signed URL, a PDF that wants a password). Callers
 * fall back to the extension tile on null — a missing thumbnail is cosmetic.
 */
export function thumbnailFor(key: string, kind: ThumbnailKind, url: string): Promise<string | null> {
  const existing = cache.get(key);
  if (existing) return existing;

  const pending = (kind === "pdf" ? renderPdfFirstPage(url) : renderHeic(url)).catch(() => null);
  cache.set(key, pending);
  return pending;
}

/** Scale to fit inside MAX_EDGE, never up — a thumbnail of a thumbnail is mush. */
function fit(width: number, height: number) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}

function toObjectUrl(canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? URL.createObjectURL(blob) : null),
      "image/jpeg",
      0.82,
    );
  });
}

let workerPort: Worker | null = null;

async function renderPdfFirstPage(url: string): Promise<string | null> {
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
  if (!response.ok) return null;
  const data = new Uint8Array(await response.arrayBuffer());

  const loading = pdfjs.getDocument({ data });
  try {
    const doc = await loading.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const { width, height, scale } = fit(base.width, base.height);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    await page.render({ canvas, viewport: page.getViewport({ scale }) }).promise;
    return await toObjectUrl(canvas);
  } finally {
    // Frees the page and its fonts; the worker itself is kept for the next file.
    void loading.destroy();
  }
}

async function renderHeic(url: string): Promise<string | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const blob = await response.blob();

  // The CSP build: same decoder, no eval, so it keeps working if a Content-
  // Security-Policy ever lands in front of this app.
  const { heicTo } = await import("heic-to/csp");
  const bitmap = await heicTo({ blob, type: "bitmap" });

  try {
    const { width, height } = fit(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    return await toObjectUrl(canvas);
  } finally {
    bitmap.close();
  }
}
