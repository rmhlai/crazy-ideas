"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/feedback", label: "Feedback", icon: "👍", badge: true },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/rankings", label: "Rankings", icon: "🏆" },
  { href: "/more", label: "More", icon: "☰" },
];

const sidebarExtra = [
  { href: "/dishes", label: "Dishes", icon: "🍱" },
  { href: "/uploads", label: "Uploads", icon: "📄" },
  { href: "/planner", label: "Plan next month", icon: "🗓️" },
  { href: "/spending", label: "Spending", icon: "💵" },
  { href: "/children", label: "Children", icon: "🧒" },
  { href: "/settings", label: "Settings & export", icon: "⚙️" },
  { href: "/kid", label: "Kid mode", icon: "😀" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span
      aria-label={`${n} unrated`}
      className="ml-auto min-w-5 rounded-full bg-red-500 px-1.5 text-center text-xs font-bold leading-5 text-white"
    >
      {n}
    </span>
  );
}

export function Nav({ pending }: { pending: number }) {
  const path = usePathname();
  if (path.startsWith("/kid")) return null;
  const moreActive = ["/more", ...sidebarExtra.map((s) => s.href)].some((h) => isActive(path, h));
  return (
    <>
      {/* wide screens: sidebar */}
      <nav className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-4 md:flex">
        <Link href="/" className="mb-4 flex items-center gap-2 px-2 text-xl font-bold text-brand-600">
          🥪 LunchBox
        </Link>
        {[...tabs.filter((t) => t.href !== "/more"), ...sidebarExtra].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${
              isActive(path, t.href) ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span aria-hidden>{t.icon}</span>
            {t.label}
            {"badge" in t && t.badge ? <Badge n={pending} /> : null}
          </Link>
        ))}
      </nav>
      {/* narrow screens: bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {tabs.map((t) => {
          const active = t.href === "/more" ? moreActive : isActive(path, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                active ? "text-brand-600" : "text-slate-500"
              }`}
            >
              <span className="text-xl leading-none" aria-hidden>
                {t.icon}
              </span>
              {t.label}
              {t.badge && pending > 0 && (
                <span className="absolute right-[22%] top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                  {pending}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
