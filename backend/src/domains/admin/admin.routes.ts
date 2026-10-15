import { Hono } from "hono";
import { lookupAdminInvitationHandler } from "./admin.handlers.js";

const admin = new Hono()
    .get("/invitations/lookup", ...lookupAdminInvitationHandler)

export default admin;
