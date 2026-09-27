import { route } from "@/lib/api/handler";
import { createUpload, HttpError, listUploads } from "@/lib/services/uploads";

export const GET = route(() => listUploads());

export const POST = route(async (req) => {
  const form = await req.formData();
  const kind = String(form.get("kind") ?? "");
  if (kind !== "order_form" && kind !== "ingredients") throw new HttpError(400, "kind must be order_form or ingredients");
  const files = await Promise.all(
    form
      .getAll("files")
      .filter((f): f is File => typeof f !== "string" && f.size > 0)
      .map(async (f) => ({ name: f.name, type: f.type, buffer: Buffer.from(await f.arrayBuffer()) })),
  );
  return createUpload(kind, files);
});
