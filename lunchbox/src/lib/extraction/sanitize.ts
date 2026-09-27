import { daysInMonth, isValidDate, isValidMonth } from "../dates";
import type { Confidence, IngredientsExtraction, OrderFormExtraction } from "./types";

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const conf = (v: unknown): Confidence => (v === "high" || v === "medium" || v === "low" ? v : "medium");
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Make model output safe to render and edit: fill missing arrays, coerce types, and only
 * derive dates from the month printed on the form (never invent one).
 */
export function sanitizeOrderForm(raw: unknown): OrderFormExtraction {
  const r = (raw ?? {}) as Record<string, unknown>;
  let month = isValidMonth(r.month) ? (r.month as string) : null;
  const days = arr<Record<string, unknown>>(r.days).map((d) => {
    let date = isValidDate(d.date) ? (d.date as string) : null;
    let dom = Number.isInteger(d.day_of_month) ? (d.day_of_month as number) : date ? Number(date.slice(8)) : 0;
    if (!date && month && dom >= 1 && dom <= daysInMonth(month)) date = `${month}-${pad(dom)}`;
    if (date && !dom) dom = Number(date.slice(8));
    return {
      date,
      day_of_month: dom,
      no_service: d.no_service === true,
      note: str(d.note),
      options: arr<Record<string, unknown>>(d.options)
        .filter((o) => str(o.dish_name))
        .map((o) => ({
          label: str(o.label),
          dish_name: str(o.dish_name)!,
          price: typeof o.price === "number" && Number.isFinite(o.price) ? o.price : null,
        })),
      selections: arr<Record<string, unknown>>(d.selections)
        .filter((s) => str(s.dish_name))
        .map((s) => ({
          child_name: str(s.child_name),
          dish_name: str(s.dish_name)!,
          quantity: Number.isInteger(s.quantity) && (s.quantity as number) > 0 ? (s.quantity as number) : 1,
          confidence: conf(s.confidence),
        })),
    };
  });
  // If the model gave dates but no month, take the month from the dates.
  if (!month) {
    const dated = days.find((d) => d.date);
    if (dated?.date) month = dated.date.slice(0, 7);
  }
  days.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.day_of_month - b.day_of_month);
  return {
    month,
    vendor: str(r.vendor),
    children_named_on_form: arr<unknown>(r.children_named_on_form).map(str).filter((s): s is string => !!s),
    days,
    warnings: arr<unknown>(r.warnings).map(str).filter((s): s is string => !!s),
  };
}

export function sanitizeIngredients(raw: unknown): IngredientsExtraction {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    vendor: str(r.vendor),
    effective_month: isValidMonth(r.effective_month) ? (r.effective_month as string) : null,
    dishes: arr<Record<string, unknown>>(r.dishes)
      .filter((d) => str(d.dish_name))
      .map((d) => ({
        dish_name: str(d.dish_name)!,
        raw_text: typeof d.raw_text === "string" ? d.raw_text : "",
        ingredients: arr<Record<string, unknown>>(d.ingredients)
          .filter((i) => str(i.name))
          .map((i) => ({
            name: str(i.name)!,
            sub_ingredients: arr<unknown>(i.sub_ingredients).map(str).filter((s): s is string => !!s),
          })),
        declared_allergens: arr<unknown>(d.declared_allergens)
          .map(str)
          .filter((s): s is string => !!s)
          .map((s) => s.toLowerCase()),
        confidence: conf(d.confidence),
      })),
    warnings: arr<unknown>(r.warnings).map(str).filter((s): s is string => !!s),
  };
}
