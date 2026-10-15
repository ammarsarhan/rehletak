import { createFactory } from "hono/factory";
import AdminService from "./admin.service.js";
import { adminInvitationTokenSchema } from "./admin.validators.js";
import validate from "../../shared/middleware/validate.js";
import { ipKey, rateLimit } from "../../shared/middleware/rateLimit.js";

const factory = createFactory();

const adminService = new AdminService();

export const lookupAdminInvitationHandler = factory.createHandlers(
    rateLimit({ limit: 30, windowMs: 15 * 60 * 1000, key: ipKey("admin:invitation:lookup") }),
    validate("query", adminInvitationTokenSchema),
    async (c) => {
        const { token } = c.req.valid("query");
        const invitation = await adminService.getInvitation(token);

        return c.json({ success: true, data: { invitation } }, 200);
    }
)
