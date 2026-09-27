import Link from "next/link";

const items = [
  ["/dishes", "🍱", "Dishes", "Catalogue, ingredients and history"],
  ["/uploads", "📄", "Uploads", "Order forms and ingredients lists"],
  ["/uploads/new", "⬆️", "New upload", "Add this month's form"],
  ["/planner", "🗓️", "Plan next month", "Suggested picks from the menu"],
  ["/spending", "💵", "Spending", "Monthly cost per child"],
  ["/children", "🧒", "Children", "Names, colours, watch-lists"],
  ["/settings", "⚙️", "Settings & export", "API key, model, backup"],
  ["/kid", "😀", "Kid mode", "Big buttons for the kids"],
] as const;

export default function MorePage() {
  return (
    <div>
      <h1 className="h1">More</h1>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map(([href, icon, title, sub]) => (
          <li key={href}>
            <Link href={href} className="card flex items-center gap-3 hover:border-brand-300">
              <span className="text-2xl" aria-hidden>
                {icon}
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="text-sm text-slate-500">{sub}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
