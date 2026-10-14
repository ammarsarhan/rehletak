// The Hono app itself, with no side effects (no listening, no port binding). src/server.ts runs it.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

import AppError from "./shared/utils/error.js";

import health from "./domains/health/health.routes.js";

const app = new Hono()
  .use("*", logger())
  .use("*", secureHeaders())
  // Only the staff and admin dashboards of this environment may call the API from a browser with cookies.
  .use("*", cors({
    origin: (process.env.CORS_ORIGINS ?? "").split(",").map(o => o.trim()).filter(Boolean),
    credentials: true,
  }))
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
  .route("/health", health);

export type AppType = typeof app;
export default app;
