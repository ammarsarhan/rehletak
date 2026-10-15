import { createFactory } from "hono/factory";
import type { Context } from "hono";
import AdminService from "./admin.service.js";
import TokenService from "../token/token.service.js";
import { acceptAdminInvitationSchema, adminInvitationTokenSchema, adminSignInSchema, adminVerifySchema } from "./admin.validators.js";
import validate from "../../shared/middleware/validate.js";
import { bodyKey, createRateLimitKey, getClientIp, ipKey, rateLimit } from "../../shared/middleware/rateLimit.js";

const factory = createFactory();

const adminService = new AdminService();

// Falls back to the connection's address when there's no proxy header (e.g. locally), so audit records always have an IP.
const getRequestInfo = (c: Context) => {
    const ip = getClientIp(c);
    return { ipAddress: ip === "unknown" ? null : ip, userAgent: c.req.header("user-agent") ?? null };
};

// Limits code guesses per admin, not just per IP, so spreading guesses across many IPs doesn't help. Only a genuine
// challenge counts: an unchecked one could name any admin and use up their attempts.
const challengeKey = (scope: string) => async (c: Context) => {
    const adminId = await TokenService.verifyChallengeCookie(c);
    return adminId ? createRateLimitKey(scope, "user", adminId) : undefined;
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

// Creates the account and signs the new admin in, since they've just proven both their password and their authenticator.
export const acceptAdminInvitationHandler = factory.createHandlers(
    rateLimit({ limit: 10, windowMs: 60 * 60 * 1000, key: ipKey("admin:invitation:accept") }),
    validate("json", acceptAdminInvitationSchema),
    async (c) => {
        const request = getRequestInfo(c);
        const created = await adminService.acceptInvitation(c.req.valid("json"), request.ipAddress);
        const { admin, ...tokens } = await adminService.createSession(created, "invitation", request);

        TokenService.setAuthenticationCookies(c, "admin", tokens);
        return c.json({ success: true, data: { admin } }, 201);
    }
)

// Step one of signing in. A correct password only earns a short-lived challenge, never a session.
export const adminSignInHandler = factory.createHandlers(
    rateLimit({ limit: 10, windowMs: 15 * 60 * 1000, key: ipKey("admin:sign-in") }),
    rateLimit({ limit: 5, windowMs: 15 * 60 * 1000, key: bodyKey("admin:sign-in", "identifier", "email") }),
    validate("json", adminSignInSchema),
    async (c) => {
        const { email, password } = c.req.valid("json");
        const admin = await adminService.checkPassword(email, password, getRequestInfo(c).ipAddress);

        await TokenService.setChallengeCookie(c, admin.id);
        return c.json({ success: true, data: { twoFactorRequired: true } }, 200);
    }
)

// Step two of signing in: the code from their authenticator app.
export const adminVerifyHandler = factory.createHandlers(
    rateLimit({ limit: 10, windowMs: 15 * 60 * 1000, key: ipKey("admin:verify") }),
    rateLimit({ limit: 5, windowMs: 5 * 60 * 1000, key: challengeKey("admin:verify") }),
    validate("json", adminVerifySchema),
    async (c) => {
        const { code } = c.req.valid("json");
        const request = getRequestInfo(c);
        const verified = await adminService.verifySignIn(await TokenService.verifyChallengeCookie(c), code, request.ipAddress);
        const { admin, ...tokens } = await adminService.createSession(verified, "password_and_totp", request);

        TokenService.clearChallengeCookie(c);
        TokenService.setAuthenticationCookies(c, "admin", tokens);
        return c.json({ success: true, data: { admin } }, 200);
    }
)
