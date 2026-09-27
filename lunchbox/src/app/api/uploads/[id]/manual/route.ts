import { intParam, route } from "@/lib/api/handler";
import { startManualEntry } from "@/lib/services/uploads";

export const POST = route<{ id: string }>((_req, p) => startManualEntry(intParam(p.id)));
