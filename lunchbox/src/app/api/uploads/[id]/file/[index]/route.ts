import fs from "node:fs";
import path from "node:path";
import { intParam, route } from "@/lib/api/handler";
import { getUpload, HttpError, uploadFolder } from "@/lib/services/uploads";

/** Serve an upload's file. ?original=1 serves the untouched original. */
export const GET = route<{ id: string; index: string }>((req, p) => {
  const u = getUpload(intParam(p.id));
  if (!u) throw new HttpError(404, "Upload not found");
  const f = u.files[Number(p.index)];
  if (!f) throw new HttpError(404, "File not found");
  const original = new URL(req.url).searchParams.get("original") === "1";
  const name = original ? f.stored : f.processed;
  const data = fs.readFileSync(path.join(uploadFolder(u), path.basename(name)));
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": original ? f.mimeType : f.processedMimeType,
      "Content-Disposition": `${original ? "attachment" : "inline"}; filename="${encodeURIComponent(original ? f.originalName : name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});
