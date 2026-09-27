/** Ingredient parsing, formatting and snapshot diffing. Pure functions. */

export type IngredientNode = { name: string; sub_ingredients?: string[] };

export function normalizeIngredient(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[*†‡]/g, "")
    .replace(/^\s*(contains|ingredients)\s*:?\s*/i, "")
    .replace(/[.;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every ingredient (top-level and nested) as a normalized, de-duplicated list. */
export function flattenIngredients(list: IngredientNode[]): string[] {
  const out = new Set<string>();
  for (const i of list) {
    const n = normalizeIngredient(i.name);
    if (n) out.add(n);
    for (const s of i.sub_ingredients ?? []) {
      const sn = normalizeIngredient(s);
      if (sn) out.add(sn);
    }
  }
  return [...out];
}

export type SnapshotLike = { ingredients: IngredientNode[]; allergens: string[] };

export type IngredientDiff = {
  added: string[];
  removed: string[];
  allergensAdded: string[];
  allergensRemoved: string[];
};

export function diffSnapshots(prev: SnapshotLike, next: SnapshotLike): IngredientDiff {
  const a = new Set(flattenIngredients(prev.ingredients));
  const b = new Set(flattenIngredients(next.ingredients));
  const pa = new Set(prev.allergens.map(normalizeIngredient).filter(Boolean));
  const pb = new Set(next.allergens.map(normalizeIngredient).filter(Boolean));
  return {
    added: [...b].filter((x) => !a.has(x)),
    removed: [...a].filter((x) => !b.has(x)),
    allergensAdded: [...pb].filter((x) => !pa.has(x)),
    allergensRemoved: [...pa].filter((x) => !pb.has(x)),
  };
}

export function isEmptyDiff(d: IngredientDiff): boolean {
  return !d.added.length && !d.removed.length && !d.allergensAdded.length && !d.allergensRemoved.length;
}

/** "rice, chicken (chicken, salt), sauce" */
export function formatIngredients(list: IngredientNode[]): string {
  return list
    .map((i) => (i.sub_ingredients?.length ? `${i.name} (${i.sub_ingredients.join(", ")})` : i.name))
    .join(", ");
}

/**
 * Parse "a, b (c, d), e" back into nested ingredients. Parentheses deeper than one level
 * are flattened into the parent's sub-ingredients. Brackets [] are treated like ().
 */
export function parseIngredientText(text: string): IngredientNode[] {
  const out: IngredientNode[] = [];
  let depth = 0;
  let current = "";
  let subs: string[] = [];
  let subCurrent = "";
  const pushSub = () => {
    const s = subCurrent.trim();
    if (s) subs.push(s);
    subCurrent = "";
  };
  const pushTop = () => {
    const name = current.trim().replace(/[.;]+$/, "");
    if (name) out.push(subs.length ? { name, sub_ingredients: subs } : { name });
    current = "";
    subs = [];
  };
  for (const ch of text) {
    if (ch === "(" || ch === "[") {
      depth++;
      if (depth > 1) pushSub(); // "soy sauce (water, soybeans)" -> soy sauce, water, soybeans
      continue;
    }
    if (ch === ")" || ch === "]") {
      if (depth >= 1) pushSub();
      depth = Math.max(0, depth - 1);
      continue;
    }
    if ((ch === "," || ch === ";") && depth === 0) {
      pushTop();
      continue;
    }
    if (ch === "," && depth >= 1) {
      pushSub();
      continue;
    }
    if (depth === 0) current += ch;
    else subCurrent += ch;
  }
  if (depth > 0) pushSub();
  pushTop();
  return out;
}

export function parseList(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
