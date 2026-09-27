import Link from "next/link";
import type { ChildDay } from "@/lib/services/days";
import { AllergenChips, DishDescription, StatusPill, WatchFlag } from "./bits";
import { FeedbackButtons } from "./FeedbackButtons";
import { OrderActions } from "./OrderActions";

type Order = ChildDay["orders"][number];

export function OrderCard({ order, editable = false, compact = false }: { order: Order; editable?: boolean; compact?: boolean }) {
  const watch = order.info.watch[order.childId] ?? [];
  const inactive = order.status !== "ordered";
  return (
    <div className={`flex flex-col gap-2 ${inactive ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/dishes/${order.dishId}`} className={`text-base font-semibold hover:underline ${inactive ? "line-through" : ""}`}>
          {order.dishName}
        </Link>
        {order.quantity > 1 && <span className="chip">×{order.quantity}</span>}
        {inactive && <StatusPill status={order.status} />}
        <WatchFlag terms={watch} loud />
      </div>
      {!compact && (
        <>
          <DishDescription description={order.info.description} dishId={order.dishId} />
          <AllergenChips allergens={order.info.allergens} />
        </>
      )}
      <div className="flex flex-wrap items-end justify-between gap-2">
        {order.canRate ? (
          <FeedbackButtons orderId={order.id} rating={order.rating} note={order.note} size="sm" />
        ) : (
          order.status === "ordered" && <span className="text-xs text-slate-400">Feedback opens after lunch</span>
        )}
        {editable && <OrderActions order={order} />}
      </div>
    </div>
  );
}
