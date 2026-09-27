import Link from "next/link";
import { pendingFeedback } from "@/lib/services/orders";
import { FeedbackQueue } from "@/components/FeedbackQueue";
import { Empty } from "@/components/bits";

export const dynamic = "force-dynamic";

export default function FeedbackPage() {
  const items = pendingFeedback();
  return (
    <div>
      <h1 className="h1">How was lunch?</h1>
      {items.length === 0 ? (
        <Empty>
          No lunches waiting for feedback. Past ratings can be changed from the{" "}
          <Link href="/calendar" className="underline">
            calendar
          </Link>
          .
        </Empty>
      ) : (
        <FeedbackQueue
          items={items.map((i) => ({
            id: i.id,
            date: i.date,
            childName: i.childName,
            color: i.color,
            dishId: i.dishId,
            dishName: i.dishName,
            rating: i.rating,
            note: i.note,
          }))}
        />
      )}
    </div>
  );
}
