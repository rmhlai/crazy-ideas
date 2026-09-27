import { intParam, route } from "@/lib/api/handler";
import { getInsights } from "@/lib/services/rankings";

export const GET = route((req) => getInsights(intParam(new URL(req.url).searchParams.get("child"), "child")));
