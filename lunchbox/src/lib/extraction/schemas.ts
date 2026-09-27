import type Anthropic from "@anthropic-ai/sdk";

const confidence = { type: "string", enum: ["high", "medium", "low"] } as const;
const nullableString = { type: ["string", "null"] } as const;

export const ORDER_FORM_TOOL: Anthropic.Tool = {
  name: "record_order_form",
  description:
    "Record everything read from a school lunch order form: the month, the menu options offered on each day, and which options were selected for which child.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["month", "vendor", "children_named_on_form", "days", "warnings"],
    properties: {
      month: {
        ...nullableString,
        description: "YYYY-MM as printed on the form. null if the form does not show the month and year.",
      },
      vendor: { ...nullableString, description: "Lunch vendor / caterer name if printed." },
      children_named_on_form: {
        type: "array",
        items: { type: "string" },
        description: "Names of children written or printed on the form (student name fields). Empty if none.",
      },
      days: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["date", "day_of_month", "no_service", "note", "options", "selections"],
          properties: {
            date: {
              ...nullableString,
              description: "YYYY-MM-DD. Only when the month and year are printed on the form; otherwise null.",
            },
            day_of_month: { type: "integer", minimum: 1, maximum: 31 },
            no_service: {
              type: "boolean",
              description: "true when there is no lunch service that day (holiday, PA day, closed).",
            },
            note: { ...nullableString, description: 'Any note printed for the day, e.g. "PA Day", "Thanksgiving".' },
            options: {
              type: "array",
              description: "All dishes offered that day, whether or not selected.",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "dish_name", "price"],
                properties: {
                  label: { ...nullableString, description: 'Option label such as "A" or "B".' },
                  dish_name: { type: "string", description: "Dish name exactly as printed." },
                  price: { type: ["number", "null"], description: "Price in dollars, e.g. 6.5" },
                },
              },
            },
            selections: {
              type: "array",
              description: "Options that were chosen (ticked, circled, written in, quantity filled).",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["child_name", "dish_name", "quantity", "confidence"],
                properties: {
                  child_name: {
                    ...nullableString,
                    description: "Which child this selection is for, if the form attributes it. null otherwise.",
                  },
                  dish_name: { type: "string", description: "Dish name exactly as printed." },
                  quantity: { type: "integer", minimum: 1 },
                  confidence,
                },
              },
            },
          },
        },
      },
      warnings: {
        type: "array",
        items: { type: "string" },
        description: "Anything you were unsure about (illegible marks, ambiguous ticks, cut-off pages).",
      },
    },
  },
};

export const INGREDIENTS_TOOL: Anthropic.Tool = {
  name: "record_ingredients",
  description: "Record the ingredient list for every dish on a school lunch ingredients/allergen sheet.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["vendor", "effective_month", "dishes", "warnings"],
    properties: {
      vendor: nullableString,
      effective_month: {
        ...nullableString,
        description: "YYYY-MM the list applies to, if printed. null otherwise.",
      },
      dishes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["dish_name", "raw_text", "ingredients", "declared_allergens", "confidence"],
          properties: {
            dish_name: { type: "string", description: "Dish name exactly as printed." },
            raw_text: { type: "string", description: "The ingredients paragraph for this dish, verbatim." },
            ingredients: {
              type: "array",
              description: "Top-level ingredients in printed order. Parenthesised components become sub_ingredients.",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "sub_ingredients"],
                properties: {
                  name: { type: "string" },
                  sub_ingredients: { type: "array", items: { type: "string" } },
                },
              },
            },
            declared_allergens: {
              type: "array",
              items: { type: "string" },
              description: 'Allergens the sheet declares for this dish ("Contains: wheat, milk"), lowercase.',
            },
            confidence,
          },
        },
      },
      warnings: { type: "array", items: { type: "string" } },
    },
  },
};
