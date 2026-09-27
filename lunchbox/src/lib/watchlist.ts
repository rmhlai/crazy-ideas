import { normalizeIngredient } from "./ingredients";

/**
 * Terms that expand to more specific ingredients, so a watch on "dairy"
 * also catches "cheddar cheese" or "whey".
 */
const EXPANSIONS: Record<string, string[]> = {
  dairy: ["milk", "cheese", "butter", "cream", "whey", "casein", "yogurt", "yoghurt", "lactose", "ghee"],
  milk: ["milk", "cheese", "butter", "cream", "whey", "casein", "yogurt", "yoghurt", "lactose", "ghee"],
  gluten: ["wheat", "barley", "rye", "spelt", "malt", "semolina", "durum"],
  wheat: ["wheat", "semolina", "durum", "spelt"],
  egg: ["egg", "albumin", "mayonnaise"],
  eggs: ["egg", "albumin", "mayonnaise"],
  "tree nut": ["almond", "cashew", "walnut", "pecan", "hazelnut", "pistachio", "macadamia", "brazil nut"],
  "tree nuts": ["almond", "cashew", "walnut", "pecan", "hazelnut", "pistachio", "macadamia", "brazil nut"],
  nuts: ["almond", "cashew", "walnut", "pecan", "hazelnut", "pistachio", "macadamia", "peanut", "brazil nut"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "clam", "mussel", "oyster", "scallop"],
  fish: ["fish", "salmon", "tuna", "cod", "pollock", "tilapia", "anchovy", "haddock"],
  soy: ["soy", "soya", "soybean", "tofu", "edamame"],
  pork: ["pork", "bacon", "ham", "prosciutto", "pepperoni", "lard"],
  sesame: ["sesame", "tahini"],
};

function singular(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("oes") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("es") && /(ch|sh|s|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
  return word;
}

function words(s: string): string[] {
  return normalizeIngredient(s)
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singular);
}

/** True if `ingredient` contains `term` as a whole word/phrase (plural-insensitive). */
export function termMatches(term: string, ingredient: string): boolean {
  const t = words(term);
  const i = words(ingredient);
  if (!t.length) return false;
  for (let k = 0; k + t.length <= i.length; k++) {
    if (t.every((w, j) => i[k + j] === w)) return true;
  }
  return false;
}

/**
 * Which watched terms hit this dish? Checks every ingredient name (including sub-ingredients)
 * and declared allergens. Returns the matched watch terms (as the user typed them).
 */
export function watchHits(watchlist: string[], ingredientNames: string[], allergens: string[] = []): string[] {
  const haystack = [...ingredientNames, ...allergens];
  const hits: string[] = [];
  for (const term of watchlist) {
    const key = normalizeIngredient(term);
    if (!key) continue;
    const needles = [key, ...(EXPANSIONS[key] ?? [])];
    if (haystack.some((h) => needles.some((n) => termMatches(n, h)))) hits.push(term);
  }
  return hits;
}
