import { z } from "zod";

const identityTokenSchema = z.string().min(1).max(8192);

export const appleCallbackSchema = z.object({
  identityToken: identityTokenSchema,
  nonce: z.string().min(1).max(256).optional(),
  state: z.string().min(32).max(256).optional(),
});

export const appleWebStartSchema = z.object({
  rememberBrowser: z.boolean().default(false),
});

export const appleNativeSchema = z.object({
  identityToken: identityTokenSchema,
  nonce: z.string().min(32).max(256),
});

export const deviceRegistrationSchema = appleCallbackSchema.extend({
  name: z.string().trim().min(1).max(80).optional(),
  clientDeviceId: z.string().uuid().optional(),
});

export const authenticatedDeviceRegistrationSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  clientDeviceId: z.string().uuid().optional(),
});

export const deviceRevocationSchema = appleCallbackSchema;

export const accountDeletionSchema = appleCallbackSchema;

export const refreshSessionSchema = z.object({
  refreshToken: z.string().min(32).max(512).optional(),
});
