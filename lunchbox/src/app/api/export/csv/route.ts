import { route } from "@/lib/api/handler";
import { ordersCsv } from "@/lib/services/export";
import { todayISO } from "@/lib/dates";

export const GET = route(
  () =>
    new Response(ordersCsv(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lunchbox-orders-${todayISO()}.csv"`,
      },
    }),
);
