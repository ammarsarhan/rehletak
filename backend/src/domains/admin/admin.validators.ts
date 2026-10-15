import z from "zod";

// Normalized the same way everywhere an admin email comes in, so it always matches how it was stored.
export const emailSchema = z
    .string({ error: "Email is required." })
    .trim()
    .toLowerCase()
    .max(75, "Email must contain 75 characters at most.")
    .pipe(z.email("Please enter a valid email address."));

const tokenSchema = z.string({ error: "Invitation token is required." }).min(1, "Invitation token is required.");

export const adminInvitationTokenSchema = z.object({
    token: tokenSchema,
});
