import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { ZipArchive } from "archiver";
import { getDb, uploadsDir } from "../db";
import { listOrders } from "./orders";
import { listChildren } from "./children";
import { addDays } from "../dates";

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ordersCsv(): string {
  const rows = listOrders({ includeInactive: true });
  const header = ["date", "child", "dish", "quantity", "price", "status", "rating", "note", "source"];
  const lines = rows.map((r) =>
    [
      r.date,
      r.childName,
      r.dishName,
      r.quantity,
      r.priceCents != null ? (r.priceCents / 100).toFixed(2) : "",
      r.status,
      r.rating === 1 ? "up" : r.rating === -1 ? "down" : "",
      r.note,
      r.uploadId ? `upload ${r.uploadId}` : "manual",
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}

/** Zip of a consistent DB copy plus every uploaded original. */
export async function backupZip(): Promise<Buffer> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lunchbox-backup-"));
  const dbCopy = path.join(tmp, "lunchbox.db");
  try {
    await getDb().$client.backup(dbCopy);
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const out = new PassThrough();
    const chunks: Buffer[] = [];
    out.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve, reject) => {
      out.on("end", () => resolve());
      archive.on("error", reject);
    });
    archive.pipe(out);
    archive.file(dbCopy, { name: "data/lunchbox.db" });
    if (fs.existsSync(uploadsDir())) archive.directory(uploadsDir(), "data/uploads");
    await archive.finalize();
    await done;
    return Buffer.concat(chunks);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** All-day calendar events for a child's lunches. */
export function lunchesIcs(childId?: number): string {
  const kids = listChildren(true);
  const rows = listOrders({ childId, includeInactive: true }).filter((r) => r.status === "ordered");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LunchBox//School Lunches//EN", "CALSCALE:GREGORIAN"];
  const name = childId ? kids.find((k) => k.id === childId)?.name : undefined;
  lines.push(`X-WR-CALNAME:${icsEscape(name ? `${name}'s lunches` : "School lunches")}`);
  for (const r of rows) {
    const d = r.date.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:lunchbox-order-${r.id}@localhost`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${addDays(r.date, 1).replace(/-/g, "")}`,
      `SUMMARY:${icsEscape(childId ? `Lunch: ${r.dishName}` : `${r.childName}: ${r.dishName}`)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
