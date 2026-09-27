import { jsonBody, route } from "@/lib/api/handler";
import { setNoSchool } from "@/lib/services/orders";

export const PUT = route<{ date: string }>(async (req, p) => {
  const body = await jsonBody<{ noSchool: boolean; note?: string | null }>(req);
  setNoSchool(p.date, !!body.noSchool, body.note);
  return { ok: true };
});
