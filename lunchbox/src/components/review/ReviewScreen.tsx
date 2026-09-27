"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { MatchResult } from "@/lib/normalize";
import type { IngredientsExtraction, OrderFormExtraction } from "@/lib/extraction/types";
import { StatusPill } from "../bits";
import { FileViewer } from "./FileViewer";
import { OrderFormEditor } from "./OrderFormEditor";
import { IngredientsEditor } from "./IngredientsEditor";

export type Kid = { id: number; name: string; color: string };

type Upload = {
  id: number;
  kind: "order_form" | "ingredients";
  status: string;
  error: string | null;
  originalFilename: string;
  confirmedAt: string | null;
  files: { originalName: string; processedMimeType: string }[];
};

export function ReviewScreen({
  upload,
  extraction,
  matches,
  kids,
  defaultMonth,
}: {
  upload: Upload;
  extraction: unknown;
  matches: Record<string, MatchResult>;
  kids: Kid[];
  defaultMonth: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function parse() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/uploads/${upload.id}/parse`, { method: "POST" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parsing failed");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  // Newly uploaded: start reading straight away.
  useEffect(() => {
    if (upload.status === "uploaded" && !started.current) {
      started.current = true;
      parse();
    }
    if (upload.status === "parsing") {
      const t = setInterval(() => router.refresh(), 3000);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload.status]);

  const reading = upload.status === "uploaded" || upload.status === "parsing" || busy;
  const title = upload.kind === "order_form" ? "Order form" : "Ingredients list";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="h1 mb-0">
            {title} <span className="text-base font-normal text-slate-400">#{upload.id}</span>
          </h1>
          <p className="text-sm text-slate-500">{upload.originalFilename}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={reading ? "parsing" : upload.status} />
          {!reading && upload.files.length > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (
                  upload.status === "needs_review" || upload.status === "confirmed"
                    ? confirm("Read the document again? Unsaved edits on this screen will be replaced.")
                    : true
                )
                  parse();
              }}
            >
              ↻ Re-parse
            </button>
          )}
          {upload.status !== "confirmed" && !reading && (
            <button
              type="button"
              className="btn-danger"
              onClick={async () => {
                if (!confirm("Delete this upload?")) return;
                await api(`/api/uploads/${upload.id}`, { method: "DELETE" });
                router.push("/uploads");
                router.refresh();
              }}
            >
              Delete
            </button>
          )}
        </div>
      </header>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {upload.error && upload.status !== "failed" && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {upload.error} {upload.status === "needs_review" && "You can enter the details by hand below."}
        </p>
      )}

      {upload.status === "confirmed" && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          ✓ Confirmed {upload.confirmedAt ? new Date(upload.confirmedAt).toLocaleString() : ""}. You can edit and confirm again — only
          this upload&apos;s entries are replaced; manual orders and feedback are never touched.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <FileViewer uploadId={upload.id} files={upload.files} />
        </div>
        <div className="min-w-0">
          {reading && (
            <div className="card flex flex-col items-center gap-3 py-10 text-center" aria-live="polite">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
              <p className="font-medium">Reading the {title.toLowerCase()}…</p>
              <p className="text-sm text-slate-500">This usually takes under a minute.</p>
            </div>
          )}
          {!reading && upload.status === "failed" && (
            <div className="card flex flex-col gap-3">
              <p className="font-semibold text-red-700">Couldn&apos;t read this document.</p>
              {upload.error && <p className="text-sm text-slate-600">{upload.error}</p>}
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={parse}>
                  Retry
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    await api(`/api/uploads/${upload.id}/manual`, { method: "POST" });
                    router.refresh();
                  }}
                >
                  Enter by hand
                </button>
              </div>
            </div>
          )}
          {!reading && (upload.status === "needs_review" || upload.status === "confirmed") && extraction != null && (
            upload.kind === "order_form" ? (
              <OrderFormEditor
                uploadId={upload.id}
                initial={extraction as OrderFormExtraction}
                initialMatches={matches}
                kids={kids}
                defaultMonth={defaultMonth}
                confirmed={upload.status === "confirmed"}
              />
            ) : (
              <IngredientsEditor
                uploadId={upload.id}
                initial={extraction as IngredientsExtraction}
                initialMatches={matches}
                defaultMonth={defaultMonth}
                confirmed={upload.status === "confirmed"}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
