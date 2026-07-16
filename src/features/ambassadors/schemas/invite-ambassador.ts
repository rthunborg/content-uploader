import { z } from "zod";
import { ambassadorCopy } from "../copy";
import { MAX_AMBASSADOR_EMAIL_LENGTH, MAX_AMBASSADOR_MOBILE_LENGTH, MAX_AMBASSADOR_NAME_LENGTH } from "@/shared/limits";

export const inviteAmbassadorSchema = z.strictObject({
  fullName: z.string().trim().min(1, { error: ambassadorCopy.required }).max(MAX_AMBASSADOR_NAME_LENGTH, { error: ambassadorCopy.tooLong }),
  email: z.string().trim().toLowerCase().max(MAX_AMBASSADOR_EMAIL_LENGTH, { error: ambassadorCopy.tooLong }).pipe(z.email({ error: ambassadorCopy.invalidEmail })),
  mobile: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(MAX_AMBASSADOR_MOBILE_LENGTH, { error: ambassadorCopy.tooLong }).regex(/^\+?[0-9](?:[0-9 .()-]*[0-9])?$/, { error: ambassadorCopy.invalidMobile }).refine((value) => { const digits = value.replace(/\D/g, "").length; return digits >= 7 && digits <= 15; }, { error: ambassadorCopy.invalidMobile }).nullable().optional(),
  ).transform((value) => value ?? null),
});

export type InviteAmbassadorInput = z.input<typeof inviteAmbassadorSchema>;
export type InviteAmbassadorValues = z.output<typeof inviteAmbassadorSchema>;
