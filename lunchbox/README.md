# LunchBox — School Lunch Order Tracker

A small, phone-friendly web app that runs on one household computer and tracks the school
lunches ordered for your children. Upload the school's monthly order form and ingredients
list; LunchBox reads them with Claude, lets you check everything on a review screen, and then:

- shows **what's for lunch today / tomorrow** for each child (or "pack a lunch" / "no school")
- collects a **👍 / 👎** after each lunch and ranks each child's **favourites**
- describes every dish by its **ingredients**, flags **ingredient changes** month to month
- warns you when a dish contains something on a child's **watch-list** (allergies, dislikes)

Everything stays local: SQLite database + uploaded files in `./data/`.

## Quick start

```bash
cd lunchbox
npm install
cp .env.example .env.local      # add your ANTHROPIC_API_KEY
npm run dev                     # http://127.0.0.1:3000
```

For daily use: `npm run build && npm start`.

Optional demo data (one fake child, a few dishes, a month of lunches, next month's menu):
`npm run db:seed`.

### Configuration (`.env.local`)

| Variable | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Needed to read uploads automatically. Without it, files are still stored and the review screen lets you type the details in. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Can also be overridden in **Settings**. |
| `ALLOW_LAN` | `false` | `true` binds `0.0.0.0` so a phone on your Wi-Fi can use it (and "Add to Home Screen" — there's a PWA manifest). |
| `PORT` | `3000` | |
| `LUNCHBOX_DATA_DIR` | `./data` | Database + uploads. **Backup = copy this folder** (or Settings → Download backup). |

## How it works

1. **Upload** an order form or ingredients list (PDF, JPG, PNG, HEIC; several photos are fine).
   Originals are kept in `data/uploads/<id>/`; HEIC is converted and images are auto-rotated
   and downsized to ~2000px before being sent to Claude.
2. Claude is called with a **tool whose input schema is the extraction schema**
   (`src/lib/extraction/schemas.ts`), so the result is structured JSON. Only the document is
   sent — children's names you enter in the app never leave the computer.
3. The **review screen** shows the original next to an editable version. Low-confidence
   selections are highlighted, the reader's warnings are listed, and every dish name is matched
   against known dishes (exact → linked, ≥ 0.85 similar → suggestion to confirm, otherwise new).
   Linking a new spelling saves it as an alias.
4. **Confirm** writes everything in one transaction. Re-confirming an order form only replaces
   orders created by that same upload; it never touches manual entries, and if an order with
   feedback would disappear it stops and asks.
5. Ingredients uploads are compared with each dish's previous snapshot: added / removed
   ingredients (including nested sub-ingredients) and allergen changes appear on the review
   screen, as a dismissible **What's changed** card on Home, and in each dish's history.

Favourites use a smoothed score `(ups + a) / (ups + downs + a + b)` with `a = b = 2`
(adjustable in Settings), so one lucky 👍 doesn't outrank a dish loved ten times.

## Screens

Home · Feedback queue · Calendar (tap a day to view/edit, add orders, mark no school) ·
Rankings (per child + household, with ingredient insights) · Dishes · Uploads/review ·
Plan next month · Spending · Children (colours + watch-lists) · Settings & export
(zip backup, CSV, per-child `.ics`) · Kid mode (big 😀 / 🙁 buttons).

## Development

```bash
npm test            # Vitest: matcher, ingredient diff, ranking, watch-list, insights, and the
                    # upload → parse (mocked Claude) → confirm pipeline against real SQLite
npm run test:e2e    # Playwright smoke test: add child → upload → confirm → rate → ranking
npm run typecheck
npm run db:generate # after editing src/lib/db/schema.ts (migrations live in ./drizzle)
```

Set `LUNCHBOX_MOCK_EXTRACTION_DIR=./fixtures/mock` to make the parse step return
`fixtures/mock/<kind>.json` instead of calling the API. Sample uploads with their expected
extraction are in `fixtures/samples/`.

Layout: `src/lib` (pure logic + `services/` + `extraction/`), `src/app` (pages and `api/`
route handlers), `src/components`.

### Notes on the spec

- The `order` table is named `orders` (SQL keyword).
- Extra tables: `day_note` (no-service days / notes from forms or marked by hand) and
  `ingredient_change` (stored diffs, so "What's changed" can be dismissed).
- The order-form schema adds `day_of_month`, so a form without a printed month/year never gets
  invented dates — you pick the month on the review screen.
