import { intParam, jsonBody, route } from "@/lib/api/handler";
import { previewIngredientChanges, type IngredientsConfirm } from "@/lib/services/uploads";

export const POST = route<{ id: string }>(async (req, p) =>
  previewIngredientChanges(intParam(p.id), await jsonBody<IngredientsConfirm>(req)),
);
