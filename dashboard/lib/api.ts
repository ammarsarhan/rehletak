import { hc } from "hono/client";
import type { AppType } from "@rehletak/backend/client";

export const api = hc<AppType>(process.env.NEXT_PUBLIC_API_URL!, { init: { credentials: "include" } });
