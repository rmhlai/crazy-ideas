import { intParam, jsonBody, route } from "@/lib/api/handler";
import { setFeedback } from "@/lib/services/orders";

export const PUT = route<{ id: string }>(async (req, p) => {
  const body = await jsonBody<{ rating: 1 | -1 | null; note?: string | null }>(req);
  return { feedback: setFeedback(intParam(p.id), body.rating, body.note) };
});
