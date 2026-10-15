import { Hono } from "hono";
import {
    acceptAdminInvitationHandler,
    adminInvitationTotpHandler,
    adminRefreshHandler,
    adminSignInHandler,
    adminVerifyHandler,
    lookupAdminInvitationHandler,
} from "./admin.handlers.js";

// The auth routes live under /admin/auth because the admin refresh cookie (and the sign in challenge) are scoped to that path.
const admin = new Hono()
    .get("/invitations/lookup", ...lookupAdminInvitationHandler)
    .post("/invitations/totp", ...adminInvitationTotpHandler)
    .post("/invitations/accept", ...acceptAdminInvitationHandler)
    .post("/auth/sign-in", ...adminSignInHandler)
    .post("/auth/verify", ...adminVerifyHandler)
    .post("/auth/refresh", ...adminRefreshHandler)

export default admin;
