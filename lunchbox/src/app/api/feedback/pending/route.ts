import { route } from "@/lib/api/handler";
import { pendingFeedback } from "@/lib/services/orders";

export const GET = route(() => pendingFeedback());
