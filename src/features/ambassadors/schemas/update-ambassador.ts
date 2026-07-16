import { z } from "zod";

import { inviteAmbassadorSchema } from "./invite-ambassador";

export const updateAmbassadorSchema = inviteAmbassadorSchema;

export type UpdateAmbassadorInput = z.input<typeof updateAmbassadorSchema>;
export type UpdateAmbassadorValues = z.output<typeof updateAmbassadorSchema>;
