import { intParam, jsonBody, route } from "@/lib/api/handler";
import { deleteOrder, updateOrder, type OrderPatch } from "@/lib/services/orders";

export const PATCH = route<{ id: string }>(async (req, p) => updateOrder(intParam(p.id), await jsonBody<OrderPatch>(req)));
export const DELETE = route<{ id: string }>((_req, p) => deleteOrder(intParam(p.id)));
