import { intParam, jsonBody, route } from "@/lib/api/handler";
import { getDishDetail, renameDish } from "@/lib/services/dishes";
import { HttpError } from "@/lib/services/uploads";

/** Includes snapshot history and the diff for each snapshot. */
export const GET = route<{ id: string }>((_req, p) => {
  const d = getDishDetail(intParam(p.id));
  if (!d) throw new HttpError(404, "Dish not found");
  return d;
});
export const PATCH = route<{ id: string }>(async (req, p) => {
  const { name } = await jsonBody<{ name: string }>(req);
  try {
    renameDish(intParam(p.id), name);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : String(e));
  }
  return getDishDetail(intParam(p.id));
});
