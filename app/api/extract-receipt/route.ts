import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { isPdf } from "@/lib/files";
import type { Extraction } from "@/lib/types";

/** Reads a file out of Supabase Storage and calls the API — Node, not Edge. */
export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5-20251001";

/**
 * Inlined base64 costs a third more on the wire, so this sits well under the
 * API's request ceiling. A bigger file is not an error — it just doesn't get
 * read, and the user types the three fields in by hand.
 */
const MAX_BYTES = 6 * 1024 * 1024;

/** Nothing read. Every failure path lands here rather than throwing at the caller. */
const BLANK: Extraction = { date: null, vendor: null, amount: null };

type ImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const SYSTEM = `You read a single scanned or photographed receipt and report three facts about it.

Return only a JSON object — no prose, no explanation, no code fence — in exactly this shape:
{"date": string | null, "vendor": string | null, "amount": number | null}

- date: the date printed on the receipt, formatted YYYY-MM-DD. Not today's date, not
  the date the photo was taken — only a date you can actually read on the receipt.
- vendor: the business that issued it, as printed ("Home Depot", "Ace Hardware").
  Not the cashier, not the customer, not a street address.
- amount: the grand total actually charged, as a plain number — the figure after tax
  and after any discount. Not a subtotal, not one line item, not the cash tendered or
  the change given. No currency symbol and no thousands separator.

If a field is illegible, cropped off, ambiguous, or simply absent, return null for it.
A null is always better than a guess: someone is about to check these numbers against
real money.`;

/**
 * Spec §6/§9: pre-fill date, vendor and amount from an uploaded receipt so the
 * user is correcting a reading rather than typing one. The values are only ever
 * suggestions — nothing here touches a cost until the user confirms them.
 *
 * The caller sends an attachment id, not a file: the row is looked up under the
 * caller's own RLS and the bytes are fetched server-side, so no client can point
 * this route at a URL of its choosing. The one exception is `dataUrl`, which the
 * browser uses to hand over a HEIC photo it has already converted to JPEG —
 * neither the API nor Node can decode HEIC, but the browser can.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const fields = (body ?? {}) as { attachmentId?: unknown; dataUrl?: unknown };
  const attachmentId = typeof fields.attachmentId === "string" ? fields.attachmentId : "";
  const dataUrl = typeof fields.dataUrl === "string" ? fields.dataUrl : null;

  if (!attachmentId) return Response.json({ error: "Missing attachment." }, { status: 400 });

  const { data: row } = await supabase
    .from("attachments")
    .select("storage_path, file_name, mime_type")
    .eq("id", attachmentId)
    .maybeSingle();

  if (!row) return Response.json({ error: "No such file." }, { status: 404 });

  try {
    const source = dataUrl
      ? fromDataUrl(dataUrl)
      : await fromStorage(supabase, row.storage_path, row.file_name, row.mime_type);

    if (!source) return Response.json(BLANK);

    return Response.json(await read(source));
  } catch (error) {
    // A receipt that cannot be read is a blank form, never a failed upload.
    console.error("[extract-receipt]", error);
    return Response.json(BLANK);
  }
}

// ------------------------------------------------------------------- the file

type Source = { kind: "image"; mediaType: ImageType; data: string } | { kind: "pdf"; data: string };

/** A JPEG the browser produced from a HEIC photo, handed over as a data URL. */
function fromDataUrl(value: string): Source | null {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  const [, mediaType, data] = match;
  // base64 runs about 4/3 the size of the bytes it encodes.
  if (data.length > MAX_BYTES * 1.4) return null;
  return { kind: "image", mediaType: mediaType as ImageType, data };
}

async function fromStorage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
  fileName: string,
  mimeType: string | null,
): Promise<Source | null> {
  const { data: blob } = await supabase.storage.from("attachments").download(storagePath);
  if (!blob || blob.size === 0 || blob.size > MAX_BYTES) return null;

  const data = Buffer.from(await blob.arrayBuffer()).toString("base64");

  if (isPdf(mimeType, fileName)) return { kind: "pdf", data };

  const mediaType = imageType(mimeType, fileName);
  // Anything else — a HEIC that reached here unconverted, a plan, a spreadsheet —
  // is not something the API can look at.
  return mediaType ? { kind: "image", mediaType, data } : null;
}

/** The four image types the API decodes, from the mime type or the file name. */
function imageType(mimeType: string | null, fileName: string): ImageType | null {
  const declared = (mimeType ?? "").toLowerCase();
  if (
    declared === "image/jpeg" ||
    declared === "image/png" ||
    declared === "image/gif" ||
    declared === "image/webp"
  ) {
    return declared;
  }

  // Phones and browsers leave mime_type blank often enough to be worth a fallback.
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  return null;
}

// ------------------------------------------------------------------ the model

async function read(source: Source): Promise<Extraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Not configured is the same outcome as unreadable: an empty form.
  if (!apiKey) {
    console.warn("[extract-receipt] ANTHROPIC_API_KEY is not set — skipping extraction.");
    return BLANK;
  }

  const client = new Anthropic({ apiKey });

  const file: Anthropic.ContentBlockParam =
    source.kind === "pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: source.data },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: source.mediaType, data: source.data },
        };

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        // The file goes first: documents read better ahead of the question.
        content: [file, { type: "text", text: "Extract the receipt details." }],
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return parse(text);
}

/** Tolerant of the model wrapping its JSON in anything; strict about the values. */
function parse(text: string): Extraction {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return BLANK;

  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return BLANK;
  }

  const fields = (raw ?? {}) as { date?: unknown; vendor?: unknown; amount?: unknown };
  return {
    date: asDate(fields.date),
    vendor: asVendor(fields.vendor),
    amount: asAmount(fields.amount),
  };
}

/** Only a real YYYY-MM-DD, because it lands straight in an `<input type="date">`. */
function asDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  const real =
    parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
  return real ? value : null;
}

function asVendor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 120);
  return trimmed === "" ? null : trimmed;
}

function asAmount(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value.replace(/[$,\s]/g, "")) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
}
