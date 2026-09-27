import { route } from "@/lib/api/handler";
import { lunchesIcs } from "@/lib/services/export";

export const GET = route((req) => {
  const c = new URL(req.url).searchParams.get("child");
  return new Response(lunchesIcs(c ? Number(c) : undefined), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="lunches${c ? `-${c}` : ""}.ics"`,
    },
  });
});
