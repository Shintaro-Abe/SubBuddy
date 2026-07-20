import { z } from "zod";

export const guidanceEventSchema = z
  .object({
    event: z.enum([
      "inventory_completed",
      "spending_viewed",
      "review_viewed",
      "measurement_configured",
      "measurement_skipped",
      "measurement_reset",
    ]),
  })
  .strict();

export type GuidanceEvent = z.infer<typeof guidanceEventSchema>["event"];
