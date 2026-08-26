import { isHeic } from "@/lib/files";
import type { Attachment, Extraction } from "@/lib/types";

/**
 * Asks the server to read an uploaded receipt (spec §6). The route does the
 * fetching and the API call; this side only has one job the server cannot do —
 * converting a HEIC photo, which every iPhone produces and nothing downstream
 * can decode, into a JPEG the model can look at.
 *
 * Throws only on a transport or auth failure. An unreadable receipt is a
 * successful call that returns three nulls.
 */
export async function extractReceipt(
  file: Pick<Attachment, "id" | "file_name" | "mime_type" | "storage_path">,
  signedUrl: string | null,
): Promise<Extraction> {
  const body: { attachmentId: string; dataUrl?: string } = { attachmentId: file.id };

  if (isHeic(file.mime_type, file.file_name) && signedUrl) {
    // Loaded on demand: the decoder is a few MB and most receipts are not HEIC.
    const { heicAsJpegDataUrl } = await import("@/lib/thumbnails");
    const dataUrl = await heicAsJpegDataUrl(signedUrl).catch(() => null);
    if (dataUrl) body.dataUrl = dataUrl;
  }

  const response = await fetch("/api/extract-receipt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`Extraction failed (${response.status})`);
  return (await response.json()) as Extraction;
}
