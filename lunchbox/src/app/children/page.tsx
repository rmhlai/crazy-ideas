import { listChildren } from "@/lib/services/children";
import { ChildrenManager } from "@/components/ChildrenManager";

export const dynamic = "force-dynamic";

export default function ChildrenPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1 mb-0">Children</h1>
      <ChildrenManager kids={listChildren(true)} />
    </div>
  );
}
