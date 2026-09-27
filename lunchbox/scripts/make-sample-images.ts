// Renders the sample order form / ingredients sheet PNGs in fixtures/samples.
import sharp from "sharp";
import fs from "node:fs";

function svg(lines: string[], title: string) {
  const h = 120 + lines.length * 34;
  const text = lines
    .map((l, i) => `<text x="40" y="${110 + i * 34}" font-family="Arial" font-size="22">${l.replace(/&/g, "&amp;")}</text>`)
    .join("");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${h}"><rect width="100%" height="100%" fill="white"/><text x="40" y="60" font-family="Arial" font-size="30" font-weight="bold">${title}</text>${text}</svg>`,
  );
}

async function main() {
  await sharp(
    svg(
      [
        "Student: Maya        Month: September 2026",
        "Tue Sep 8   [X] A Chicken Teriyaki Bowl $6.50   [ ] B Cheese Pizza $5.75",
        "Wed Sep 9   [X] A Mac & Cheese $5.50            [ ] B Veggie Wrap $6.00",
        "Thu Sep 10  PA Day - no lunch service",
        "Fri Sep 11  [ ] A Beef Tacos $6.25              [x] B Cheese Pizza $5.75",
      ],
      "Sunny Lunch Co. - Lunch Order Form",
    ),
  )
    .png()
    .toFile("fixtures/samples/order-form-2026-09.png");
  await sharp(
    svg(
      [
        "Chicken Teriyaki Bowl: Rice, chicken (chicken, salt), teriyaki sauce",
        "   (soy sauce (water, soybeans, wheat), sugar), broccoli. Contains: soy, wheat",
        "Cheese Pizza: Crust (enriched wheat flour, water, yeast), tomato sauce,",
        "   mozzarella cheese. Contains: wheat, milk",
      ],
      "Sunny Lunch Co. - Ingredients, September 2026",
    ),
  )
    .png()
    .toFile("fixtures/samples/ingredients-2026-09.png");
  console.log("ok", fs.readdirSync("fixtures/samples"));
}
main();
