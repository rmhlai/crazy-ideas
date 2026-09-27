import { UploadForm } from "@/components/UploadForm";
import { hasApiKey } from "@/lib/services/settings";

export default async function NewUploadPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1 mb-0">New upload</h1>
      {!hasApiKey() && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          No Anthropic API key is set, so the file will be stored and you can type in the details by hand. Add{" "}
          <code>ANTHROPIC_API_KEY</code> to <code>.env.local</code> to read forms automatically.
        </p>
      )}
      <UploadForm initialKind={kind === "ingredients" ? "ingredients" : "order_form"} />
    </div>
  );
}
