import { serve } from "@hono/node-server";

import app from "./app.js";
import { prisma } from "./shared/utils/prisma.js";
import { cache } from "./shared/utils/redis.js";

// HTTP entry point, deployed as its own Railway service. Railway injects PORT.
const server = serve({
    fetch: app.fetch,
    port: Number(process.env.PORT ?? 8080),
    hostname: "::",
}, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});

// Railway sends SIGTERM on redeploy. Stop taking new requests, then close connections.
const shutdown = () => {
    server.close(async () => {
        await Promise.all([cache.quit(), prisma.$disconnect()]);
        process.exit(0);
    });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
