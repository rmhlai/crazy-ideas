import { jsonBody, route } from "@/lib/api/handler";
import { dismissChanges } from "@/lib/services/uploads";

export const POST = route(async (req) => {
  const { ids } = await jsonBody<{ ids: number[] | "all" }>(req);
  dismissChanges(ids);
  return { ok: true };
});
