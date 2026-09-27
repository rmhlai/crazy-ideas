export type Confidence = "high" | "medium" | "low";

export type OrderFormExtraction = {
  month: string | null;
  vendor: string | null;
  children_named_on_form: string[];
  days: OrderFormDay[];
  warnings: string[];
};

export type OrderFormDay = {
  /** YYYY-MM-DD, or null if the form shows only a day number and no month/year */
  date: string | null;
  day_of_month: number;
  no_service: boolean;
  note: string | null;
  options: { label: string | null; dish_name: string; price: number | null }[];
  selections: {
    child_name: string | null;
    dish_name: string;
    quantity: number;
    confidence: Confidence;
  }[];
};

export type IngredientsExtraction = {
  vendor: string | null;
  effective_month: string | null;
  dishes: {
    dish_name: string;
    raw_text: string;
    ingredients: { name: string; sub_ingredients: string[] }[];
    declared_allergens: string[];
    confidence: Confidence;
  }[];
  warnings: string[];
};

export type Extraction = OrderFormExtraction | IngredientsExtraction;

export type UploadKind = "order_form" | "ingredients";

export function emptyOrderForm(month: string | null = null): OrderFormExtraction {
  return { month, vendor: null, children_named_on_form: [], days: [], warnings: [] };
}

export function emptyIngredients(month: string | null = null): IngredientsExtraction {
  return { vendor: null, effective_month: month, dishes: [], warnings: [] };
}
