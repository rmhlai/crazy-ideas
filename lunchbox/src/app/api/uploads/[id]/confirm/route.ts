import { intParam, jsonBody, route } from "@/lib/api/handler";
import {
  confirmIngredients,
  confirmOrderForm,
  getUpload,
  HttpError,
  type IngredientsConfirm,
  type OrderFormConfirm,
} from "@/lib/services/uploads";

export const POST = route<{ id: string }>(async (req, p) => {
  const id = intParam(p.id);
  const u = getUpload(id);
  if (!u) throw new HttpError(404, "Upload not found");
  if (u.kind === "order_form") return confirmOrderForm(id, await jsonBody<OrderFormConfirm>(req));
  return confirmIngredients(id, await jsonBody<IngredientsConfirm>(req));
});
