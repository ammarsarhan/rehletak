import { Hono } from "hono";
import { acceptAdminInvitationHandler, adminInvitationTotpHandler, lookupAdminInvitationHandler } from "./admin.handlers.js";

const admin = new Hono()
    .get("/invitations/lookup", ...lookupAdminInvitationHandler)
    .post("/invitations/totp", ...adminInvitationTotpHandler)
    .post("/invitations/accept", ...acceptAdminInvitationHandler)

export default admin;
