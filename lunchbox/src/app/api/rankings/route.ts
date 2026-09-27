import { route } from "@/lib/api/handler";
import { getRankings } from "@/lib/services/rankings";

export const GET = route((req) => {
  const c = new URL(req.url).searchParams.get("child") ?? "all";
  return getRankings(c === "all" ? "all" : Number(c));
});
