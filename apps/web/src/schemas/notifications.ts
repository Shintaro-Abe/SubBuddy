import { z } from "zod";
import { isSupportedTimeZone } from "@/domain/notifications/time-zone";

export const notificationPreferencePatchSchema = z
  .object({
    yearlyRenewalEnabled: z.boolean().optional(),
    monthlyRenewalEnabled: z.boolean().optional(),
    syncFailureEnabled: z.boolean().optional(),
    newSignInPushEnabled: z.boolean().optional(),
    promptDismissed: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "at least one setting is required");

export const pushTokenSchema = z
  .object({
    token: z.string().regex(/^[a-fA-F0-9]{32,512}$/),
    environment: z.enum(["sandbox", "production"]),
    deliveryEnabled: z.boolean(),
    timeZone: z
      .string()
      .min(1)
      .max(64)
      .refine(isSupportedTimeZone, "unsupported time zone")
      .optional(),
  })
  .strict();
