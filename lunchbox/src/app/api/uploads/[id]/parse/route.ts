import { intParam, route } from "@/lib/api/handler";
import { parseUpload } from "@/lib/services/uploads";

export const maxDuration = 300;
export const POST = route<{ id: string }>((_req, p) => parseUpload(intParam(p.id)));
