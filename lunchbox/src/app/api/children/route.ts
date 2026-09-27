import { jsonBody, route } from "@/lib/api/handler";
import { createChild, listChildren, type ChildInput } from "@/lib/services/children";

export const GET = route((req) => listChildren(new URL(req.url).searchParams.get("all") === "1"));
export const POST = route(async (req) => createChild(await jsonBody<ChildInput>(req)));
