import { jsonBody, route } from "@/lib/api/handler";
import { matchNames } from "@/lib/services/dishes";

export const POST = route(async (req) => {
  const { names } = await jsonBody<{ names: string[] }>(req);
  return matchNames(Array.isArray(names) ? names.slice(0, 500) : []);
});
