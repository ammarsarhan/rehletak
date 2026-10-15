// The Hono app itself, with no side effects (no listening, no port binding). src/server.ts runs it.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

import AppError from "./shared/utils/error.js";
import { requestLogger } from "./shared/middleware/logger.js";
import { requireOrigin } from "./shared/middleware/origin.js";

import health from "./domains/health/health.routes.js";
import admin from "./domains/admin/admin.routes.js";

// The staff and admin dashboards of this environment, the only browser origins allowed to call the API with cookies.
const origins = (process.env.CORS_ORIGINS ?? "").split(",").map(o => o.trim()).filter(Boolean);

const app = new Hono()
  .use("*", requestLogger())
  .use("*", secureHeaders())
  .use("*", cors({ origin: origins, credentials: true }))
  .use("*", requireOrigin(origins))
  .onError((err, c) => {
    // Handle the AppErrors we throw throughout the application's logic.
    if (err instanceof AppError) {
      return c.json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      }, err.statusCode);
    }

    // Handle the validation errors that we have on each validatable route.
    if (err instanceof HTTPException) {
      const cause = err.cause;

      // Unpack the error and parse it into a formattable form on the frontend.
      if (cause instanceof ZodError) {
        return c.json({
          success: false,
          error: {
            message: "Validation failed",
            fields: cause.issues.map(i => ({
              field: i.path.join("."),
              message: i.message,
            })),
          },
        }, 400);
      }

      return c.json({
        success: false,
        error: {
          message: err.message,
        },
      }, err.status);
    }

    console.error("Unhandled error:", err);

    return c.json({
      success: false,
      error: {
        message: "Internal Server Error",
      },
    }, 500);
  })
  .route("/health", health)
  .route("/admin", admin);

export type AppType = typeof app;
export default app;
