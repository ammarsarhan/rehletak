import { prisma } from "../../shared/utils/prisma.js";
import { generateToken, hashToken } from "../../shared/utils/token.js";
import { decrypt, encrypt } from "../../shared/utils/encryption.js";
import { createTotpSecret, getTotpUri } from "../../shared/utils/totp.js";
import { BadRequestError, ConflictError, ERROR_CODES, ServiceUnavailableError } from "../../shared/utils/error.js";
import MessagingService from "../messaging/messaging.service.js";
import AuditService, { AUDIT_ACTIONS } from "../audit/audit.service.js";

export default class AdminService {
    private readonly messagingService = new MessagingService();

    // Shorter than staff invitations, since an admin account has more power.
    private readonly INVITATION_LIFETIME = 48 * 60 * 60 * 1000;

    // Where invitation links point. Required in production, so a link can never point at localhost.
    private getAdminUrl = () => {
        const url = process.env.ADMIN_URL;
        if (url) return url;

        if (process.env.NODE_ENV === "production") throw new Error("ADMIN_URL is not defined. Please define it in the environment variables.");
        return "http://admin.localhost:3000";
    }

    // Invites the very first admin. Only works while there are no admins at all: after that, every admin is invited by
    // another admin, so nobody gets in without an admin on record behind it. Running it again before the invitation is
    // accepted (e.g. to fix a typo in the email) revokes the earlier links, so only the newest one works.
    inviteFirstAdmin = async (email: string) => {
        const token = generateToken();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.INVITATION_LIFETIME);

        const invitation = await prisma.$transaction(async (tx) => {
            if (await tx.admin.count() > 0) throw new ConflictError("An admin already exists. Further admins must be invited by an admin.", ERROR_CODES.ACCOUNT_ALREADY_EXISTS);

            // With no admins yet, every pending invitation came from an earlier seed.
            const pending = await tx.adminInvitation.findMany({
                where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
                select: { id: true, email: true },
            });

            if (pending.length > 0) {
                await tx.adminInvitation.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { revokedAt: now } });

                for (const { id, email } of pending) {
                    await AuditService.record({ adminId: null, action: AUDIT_ACTIONS.INVITATION_REVOKED, entityType: "AdminInvitation", entityId: id, after: { email, reason: "replaced_by_seed" } }, tx);
                }
            }

            return tx.adminInvitation.create({ data: { email, tokenHash: hashToken(token), invitorId: null, expiresAt } });
        });

        return this.deliverInvitation(invitation.id, email, token, expiresAt, { invitorId: null, ipAddress: null });
    }

    // Emails the link and records it. Nobody received a link that failed to send, so it's revoked straight away and only
    // a delivered invitation is recorded as sent.
    private deliverInvitation = async (invitationId: string, email: string, token: string, expiresAt: Date, { invitorId, ipAddress }: { invitorId: string | null; ipAddress: string | null }) => {
        const link = `${this.getAdminUrl()}/invite?token=${token}`;

        try {
            await this.messagingService.sendAdminInvitation(email, link, expiresAt);
        } catch (error) {
            await prisma.adminInvitation.update({ where: { id: invitationId }, data: { revokedAt: new Date() } });

            console.error("Failed to send admin invitation:", error);
            throw new ServiceUnavailableError("We couldn't send the invitation email. Please try again.");
        }

        await AuditService.record({
            adminId: invitorId,
            action: AUDIT_ACTIONS.INVITATION_SENT,
            entityType: "AdminInvitation",
            entityId: invitationId,
            after: { email, expiresAt: expiresAt.toISOString() },
            ipAddress,
        });

        return { email, expiresAt };
    }

    // Finds an invitation that can still be accepted, or explains why it can't.
    private findUsableInvitation = async (token: string) => {
        const invitation = await prisma.adminInvitation.findUnique({ where: { tokenHash: hashToken(token) } });

        if (!invitation || invitation.acceptedAt || invitation.revokedAt) {
            throw new BadRequestError("This invitation link is invalid or has already been used.", ERROR_CODES.INVITATION_INVALID);
        }

        if (invitation.expiresAt <= new Date()) {
            throw new BadRequestError("This invitation has expired. Ask for a new one.", ERROR_CODES.INVITATION_EXPIRED);
        }

        return invitation;
    }

    // What the invitee sees before accepting, without using up the invitation.
    getInvitation = async (token: string) => {
        const { email, expiresAt } = await this.findUsableInvitation(token);
        return { email, expiresAt };
    }

    // Gives the invitee a two-factor secret to add to their authenticator app. The same secret comes back if they ask again
    // (e.g. after a refresh), so a code from an app they already set up keeps working. Only a new secret is recorded.
    startTotpSetup = async (token: string, ipAddress: string | null) => {
        const invitation = await this.findUsableInvitation(token);

        if (invitation.totpSecret) {
            const secret = decrypt(invitation.totpSecret);
            return { uri: getTotpUri(secret, invitation.email), secret };
        }

        const secret = createTotpSecret();

        await prisma.$transaction(async (tx) => {
            // Only fills an empty slot, so two requests at once can't hand out two different secrets.
            const { count } = await tx.adminInvitation.updateMany({
                where: { id: invitation.id, totpSecret: null, acceptedAt: null, revokedAt: null },
                data: { totpSecret: encrypt(secret) },
            });

            if (count === 0) return;

            await AuditService.record({ adminId: null, action: AUDIT_ACTIONS.INVITATION_TOTP_ISSUED, entityType: "AdminInvitation", entityId: invitation.id, ipAddress }, tx);
        });

        // Whichever secret was stored is the one that counts, even if another request stored it first.
        const stored = await prisma.adminInvitation.findUniqueOrThrow({ where: { id: invitation.id }, select: { totpSecret: true } });
        if (!stored.totpSecret) throw new BadRequestError("This invitation link is invalid or has already been used.", ERROR_CODES.INVITATION_INVALID);

        const current = decrypt(stored.totpSecret);
        return { uri: getTotpUri(current, invitation.email), secret: current };
    }
}
