import { z } from "zod";

const identityTokenSchema = z.string().min(1).max(8192);

export const appleCallbackSchema = z.object({
  identityToken: identityTokenSchema,
  nonce: z.string().min(1).max(256).optional(),
});

export const deviceRegistrationSchema = appleCallbackSchema.extend({
  name: z.string().trim().min(1).max(80).optional(),
});

export const deviceRevocationSchema = appleCallbackSchema;
