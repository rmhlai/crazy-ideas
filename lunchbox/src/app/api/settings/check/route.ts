import { route } from "@/lib/api/handler";
import { checkApiKey } from "@/lib/extraction/claude";
import { getModel } from "@/lib/services/settings";

export const POST = route(() => checkApiKey(getModel()));
