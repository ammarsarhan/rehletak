import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { serve } from "@hono/node-server";

import app from "./app.js";
import { prisma } from "./shared/utils/prisma.js";
import { cache } from "./shared/utils/redis.js";

// Locally the API runs on https://api.local.rehletak.app with an mkcert certificate, so its cookies behave exactly as
// in production (same site as the dashboards, Secure). On Railway these are never set: Railway terminates TLS itself.
const tls = process.env.TLS_CERT && process.env.TLS_KEY
    ? { cert: readFileSync(process.env.TLS_CERT), key: readFileSync(process.env.TLS_KEY) }
    : null;

// HTTP entry point, deployed as its own Railway service. Railway injects PORT.
const server = serve({
    fetch: app.fetch,
    port: Number(process.env.PORT ?? 8080),
    hostname: "::",
    ...(tls ? { createServer, serverOptions: tls } : {}),
}, (info) => {
    console.log(`Server is running on port ${info.port} (${tls ? "https" : "http"})`);
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
