import { createFactory } from "hono/factory";
import type { Context } from "hono";
import AdminService from "./admin.service.js";
import { adminInvitationTokenSchema } from "./admin.validators.js";
import validate from "../../shared/middleware/validate.js";
import { getClientIp, ipKey, rateLimit } from "../../shared/middleware/rateLimit.js";

const factory = createFactory();

const adminService = new AdminService();

// Falls back to the connection's address when there's no proxy header (e.g. locally), so audit records always have an IP.
const getRequestInfo = (c: Context) => {
    const ip = getClientIp(c);
    return { ipAddress: ip === "unknown" ? null : ip, userAgent: c.req.header("user-agent") ?? null };
};

export const lookupAdminInvitationHandler = factory.createHandlers(
    rateLimit({ limit: 30, windowMs: 15 * 60 * 1000, key: ipKey("admin:invitation:lookup") }),
    validate("query", adminInvitationTokenSchema),
    async (c) => {
        const { token } = c.req.valid("query");
        const invitation = await adminService.getInvitation(token);

        return c.json({ success: true, data: { invitation } }, 200);
    }
)

export const adminInvitationTotpHandler = factory.createHandlers(
    rateLimit({ limit: 20, windowMs: 60 * 60 * 1000, key: ipKey("admin:invitation:totp") }),
    validate("json", adminInvitationTokenSchema),
    async (c) => {
        const { token } = c.req.valid("json");
        const totp = await adminService.startTotpSetup(token, getRequestInfo(c).ipAddress);

        return c.json({ success: true, data: { totp } }, 200);
    }
)
