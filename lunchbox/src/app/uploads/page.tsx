import Link from "next/link";
import { listUploads } from "@/lib/services/uploads";
import { Empty, StatusPill } from "@/components/bits";
import { formatMonth } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default function UploadsPage() {
  const uploads = listUploads();
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="h1 mb-0">Uploads</h1>
        <Link href="/uploads/new" className="btn-primary">
          + New upload
        </Link>
      </header>
      {uploads.length === 0 ? (
        <Empty>Upload the school&apos;s order form or ingredients list to get started.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {uploads.map((u) => (
            <li key={u.id}>
              <Link href={`/uploads/${u.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-brand-300">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {u.kind === "order_form" ? "📝 Order form" : "🧾 Ingredients list"}
                    {u.month && <span className="ml-2 font-normal text-slate-500">{formatMonth(u.month)}</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    #{u.id} · {u.originalFilename} · {new Date(u.createdAt).toLocaleDateString()}
                  </p>
                  {u.error && <p className="text-xs text-red-600">{u.error}</p>}
                </div>
                <StatusPill status={u.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
