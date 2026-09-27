import { route } from "@/lib/api/handler";
import { listChanges } from "@/lib/services/uploads";

export const GET = route((req) => {
  const q = new URL(req.url).searchParams;
  return listChanges({ since: q.get("since") ?? undefined, undismissedOnly: q.get("undismissed") === "1" });
});
