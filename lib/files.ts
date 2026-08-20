/**
 * What a file *is*, for the sake of showing it rather than just naming it.
 * Images get a real thumbnail; everything else gets its extension on a tile,
 * which is what a file manager does and is enough to recognise a plan set from
 * a signed contract at a glance.
 */

/**
 * HEIC is what an iPhone shoots, so it turns up constantly on a build site — and
 * no browser but Safari will draw one in an `<img>`. It is an image, but it has
 * to be decoded first, so it is called out separately everywhere it matters.
 */
export function isHeic(mimeType: string | null | undefined, fileName?: string): boolean {
  if (mimeType === "image/heic" || mimeType === "image/heif") return true;
  return /\.(heic|heif)$/i.test(fileName ?? "");
}

/** An image the browser can render straight from its URL — HEIC excluded. */
export function isImage(mimeType: string | null | undefined, fileName?: string): boolean {
  if (isHeic(mimeType, fileName)) return false;
  if (mimeType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(fileName ?? "");
}

export function isPdf(mimeType: string | null | undefined, fileName?: string): boolean {
  return mimeType === "application/pdf" || /\.pdf$/i.test(fileName ?? "");
}

/** The short badge shown on a non-image tile — "PDF", "DOCX", "XLSX". */
export function fileExtension(fileName: string): string {
  const match = /\.([a-z0-9]{1,5})$/i.exec(fileName);
  return match ? match[1].toUpperCase() : "FILE";
}

/** A plain-language kind, for the detail view. */
export function fileKind(mimeType: string | null | undefined, fileName: string): string {
  if (isHeic(mimeType, fileName)) return "HEIC image";
  if (isImage(mimeType, fileName)) return "Image";
  if (isPdf(mimeType, fileName)) return "PDF document";
  if (/\.(docx?|odt|rtf)$/i.test(fileName)) return "Document";
  if (/\.(xlsx?|csv|ods)$/i.test(fileName)) return "Spreadsheet";
  if (/\.(zip|rar|7z)$/i.test(fileName)) return "Archive";
  return fileExtension(fileName) + " file";
}

/** Long file names truncate in the middle so the extension stays readable. */
export function shortName(fileName: string, max = 28): string {
  if (fileName.length <= max) return fileName;
  const ext = /\.[a-z0-9]{1,5}$/i.exec(fileName)?.[0] ?? "";
  const stem = fileName.slice(0, fileName.length - ext.length);
  return `${stem.slice(0, Math.max(4, max - ext.length - 1))}…${ext}`;
}
