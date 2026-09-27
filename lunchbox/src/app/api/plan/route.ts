import { route } from "@/lib/api/handler";
import { planMonth } from "@/lib/services/planner";
import { isValidMonth, upcomingMonth } from "@/lib/dates";

export const GET = route((req) => {
  const m = new URL(req.url).searchParams.get("month");
  return planMonth(isValidMonth(m) ? m! : upcomingMonth());
});
