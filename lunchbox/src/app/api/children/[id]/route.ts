import { intParam, jsonBody, route } from "@/lib/api/handler";
import { archiveChild, getChild, updateChild, type ChildInput } from "@/lib/services/children";
import { HttpError } from "@/lib/services/uploads";

export const GET = route<{ id: string }>((_req, p) => {
  const c = getChild(intParam(p.id));
  if (!c) throw new HttpError(404, "Child not found");
  return c;
});
export const PATCH = route<{ id: string }>(async (req, p) => updateChild(intParam(p.id), await jsonBody<ChildInput>(req)));
/** Soft delete (active = false) so history and rankings survive. */
export const DELETE = route<{ id: string }>((_req, p) => archiveChild(intParam(p.id)));
