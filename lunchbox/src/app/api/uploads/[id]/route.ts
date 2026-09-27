import { intParam, route } from "@/lib/api/handler";
import { deleteUpload, getReview } from "@/lib/services/uploads";

export const GET = route<{ id: string }>((_req, p) => getReview(intParam(p.id)));
export const DELETE = route<{ id: string }>((_req, p) => deleteUpload(intParam(p.id)));
