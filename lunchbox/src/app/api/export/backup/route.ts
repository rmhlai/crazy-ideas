import { route } from "@/lib/api/handler";
import { backupZip } from "@/lib/services/export";
import { todayISO } from "@/lib/dates";

export const GET = route(async () => {
  const zip = await backupZip();
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="lunchbox-backup-${todayISO()}.zip"`,
    },
  });
});
