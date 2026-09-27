export const SYSTEM_PROMPT =
  "You read documents for a family's school-lunch tracking app. Transcribe exactly what the document shows; never guess or fill gaps with plausible-looking data. Report uncertainty in the warnings field and via per-item confidence.";

export function orderFormPrompt(): string {
  return `This is a school lunch order form (possibly several pages or photos of one form). Read it and call the record_order_form tool once with everything on it.

Guidance:
- Forms may be scanned, photographed at an angle, or filled in by hand with ticks, circles, crosses or written quantities. A choice that has been crossed out or scribbled over is NOT selected.
- List every dish offered each day under "options", whether or not it was chosen. List only chosen dishes under "selections".
- If the form covers several children (e.g. one column per child), attribute each selection to that child's name as written. If the form has no child name, use child_name: null.
- Never invent dates. Use the month and year printed on the form. If the form does not show them, set month to null and each day's date to null, and still give day_of_month.
- Days with no lunch service (holidays, PA days, closures) get no_service: true and the printed reason as the note.
- Return dish names exactly as printed, including the vendor's spelling. Do not tidy or merge them.
- Prices are in dollars as numbers (6.50 -> 6.5). Use null when no price is printed.
- Use confidence "low" for any selection you are not sure about, and explain in warnings.`;
}

export function ingredientsPrompt(): string {
  return `This is a school lunch ingredients / allergen list (possibly several pages). Read it and call the record_ingredients tool once with every dish on it.

Guidance:
- dish_name: exactly as printed.
- raw_text: the dish's ingredients paragraph copied verbatim.
- ingredients: the top-level ingredients in printed order. When an ingredient lists its own components in parentheses or brackets, e.g. "enriched flour (wheat flour, niacin, iron)", put the components in sub_ingredients. Otherwise sub_ingredients is [].
- declared_allergens: only allergens the sheet explicitly declares for the dish (e.g. a "Contains:" line or allergen columns), lowercase.
- effective_month: the month/year the list applies to (YYYY-MM) if printed, else null.
- Use confidence "low" for any dish whose text was hard to read, and explain in warnings.`;
}
