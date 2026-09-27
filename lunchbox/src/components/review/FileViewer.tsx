"use client";

import { useState } from "react";

type F = { originalName: string; processedMimeType: string };

export function FileViewer({ uploadId, files }: { uploadId: number; files: F[] }) {
  const [i, setI] = useState(0);
  const f = files[i];
  if (!f) return null;
  const src = `/api/uploads/${uploadId}/file/${i}`;
  return (
    <div className="card flex flex-col gap-2 p-2">
      {files.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {files.map((x, j) => (
            <button key={j} type="button" onClick={() => setI(j)} className={`chip px-3 py-1 ${i === j ? "bg-slate-800 text-white" : ""}`}>
              Page {j + 1}
            </button>
          ))}
        </div>
      )}
      {f.processedMimeType === "application/pdf" ? (
        <iframe src={src} title={f.originalName} className="h-[60vh] w-full rounded-lg border-0 lg:h-[80vh]" />
      ) : (
        <a href={src} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Uploaded ${f.originalName}`} className="max-h-[80vh] w-full rounded-lg object-contain" />
        </a>
      )}
      <a href={`${src}?original=1`} className="text-xs text-slate-500 underline">
        Download original ({f.originalName})
      </a>
    </div>
  );
}
