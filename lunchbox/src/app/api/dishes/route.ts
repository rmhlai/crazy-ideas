import { route } from "@/lib/api/handler";
import { listDishes } from "@/lib/services/dishes";

export const GET = route((req) => listDishes(new URL(req.url).searchParams.get("q") ?? undefined));
