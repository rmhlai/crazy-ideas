import { jsonBody, route } from "@/lib/api/handler";
import { createOrder, listOrders, type NewOrder } from "@/lib/services/orders";

export const GET = route((req) => {
  const q = new URL(req.url).searchParams;
  return listOrders({
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
    childId: q.get("child") ? Number(q.get("child")) : undefined,
  });
});
export const POST = route(async (req) => createOrder(await jsonBody<NewOrder>(req)));
