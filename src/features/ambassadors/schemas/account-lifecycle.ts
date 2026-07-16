import { z } from "zod";

export const accountLifecycleSchema = z.strictObject({
  action: z.enum(["deactivate", "reactivate"]),
});

export type AccountLifecycleInput = z.input<typeof accountLifecycleSchema>;
export type AccountLifecycleValues = z.output<typeof accountLifecycleSchema>;
