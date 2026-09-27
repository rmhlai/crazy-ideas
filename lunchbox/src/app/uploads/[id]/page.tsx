import Link from "next/link";
import { notFound } from "next/navigation";
import { getReview, getUpload } from "@/lib/services/uploads";
import { ReviewScreen } from "@/components/review/ReviewScreen";

export const dynamic = "force-dynamic";

function savedSummary(raw?: string): string | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Record<string, number>;
    if ("snapshots" in r) return `Saved ingredients for ${r.snapshots} dish${r.snapshots === 1 ? "" : "es"}; ${r.changed} changed since the last list.`;
    const parts = [`${r.created} lunch${r.created === 1 ? "" : "es"} added`];
    if (r.updated) parts.push(`${r.updated} updated`);
    if (r.removed) parts.push(`${r.removed} removed`);
    if (r.skipped) parts.push(`${r.skipped} already entered by hand (left alone)`);
    if (r.keptAsManual) parts.push(`${r.keptAsManual} kept as manual entries`);
    return `Saved: ${parts.join(", ")}.`;
  } catch {
    return null;
  }
}

export default async function UploadReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const saved = savedSummary((await searchParams).saved);
  if (!getUpload(Number(id))) notFound();
  const r = getReview(Number(id));
  return (
    <div className="flex flex-col gap-4">
      <Link href="/uploads" className="text-sm text-slate-500 hover:underline">
        ← Uploads
      </Link>
      {saved && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-600 p-3 text-sm font-medium text-white" role="status">
          ✓ {saved}
          <Link href="/" className="underline">
            Go home
          </Link>
        </div>
      )}
      <ReviewScreen
        key={`${r.upload.id}-${r.upload.status}-${r.upload.confirmedAt ?? ""}`}
        upload={r.upload}
        extraction={r.extraction}
        matches={r.matches}
        kids={r.children.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        defaultMonth={r.defaultMonth}
      />
    </div>
  );
}
