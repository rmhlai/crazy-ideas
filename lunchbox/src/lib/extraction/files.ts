import sharp from "sharp";

export const MAX_EDGE = 2000;

export type ProcessedFile = { buffer: Buffer; mimeType: string; ext: string; pages?: number };

export function detectMime(filename: string, provided?: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const byExt: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    heif: "image/heif",
    webp: "image/webp",
    gif: "image/gif",
  };
  if (provided && provided !== "application/octet-stream" && provided !== "") return provided;
  return byExt[ext] ?? "application/octet-stream";
}

export const ACCEPTED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "image/gif",
]);

/** Rough page count from the PDF object table. Good enough for display. */
export function countPdfPages(buf: Buffer): number | undefined {
  const s = buf.toString("latin1");
  const m = s.match(/\/Type\s*\/Page(?!s)/g);
  return m ? m.length : undefined;
}

async function heicToJpeg(buf: Buffer): Promise<Buffer> {
  const convert = (await import("heic-convert")).default;
  const out = await convert({ buffer: buf, format: "JPEG", quality: 0.9 });
  return Buffer.from(out as ArrayBuffer);
}

/**
 * Normalise an upload for the model and the review screen:
 * PDF -> unchanged; HEIC -> JPEG; images -> auto-rotated and downsized to ~2000px long edge.
 */
export async function processFile(buf: Buffer, mimeType: string): Promise<ProcessedFile> {
  if (mimeType === "application/pdf") {
    return { buffer: buf, mimeType, ext: "pdf", pages: countPdfPages(buf) };
  }
  let input = buf;
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    input = await heicToJpeg(buf);
  }
  const out = await sharp(input)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { buffer: out, mimeType: "image/jpeg", ext: "jpg", pages: 1 };
}
