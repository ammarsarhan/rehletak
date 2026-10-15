import { Hono } from "hono";
import { adminInvitationTotpHandler, lookupAdminInvitationHandler } from "./admin.handlers.js";

const admin = new Hono()
    .get("/invitations/lookup", ...lookupAdminInvitationHandler)
    .post("/invitations/totp", ...adminInvitationTotpHandler)

export default admin;
