CREATE TYPE "NotificationKind" AS ENUM (
  'renewal_reminder',
  'sync_failure',
  'new_sign_in',
  'account_deletion_scheduled',
  'safety_incident'
);

CREATE TYPE "NotificationChannel" AS ENUM ('apns', 'in_app');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'pending',
  'processing',
  'sent',
  'retryable_failure',
  'permanent_failure',
  'canceled'
);
CREATE TYPE "PushEnvironment" AS ENUM ('sandbox', 'production');
CREATE TYPE "SafetyBroadcastStatus" AS ENUM ('previewed', 'confirmed', 'completed', 'canceled');

ALTER TABLE "devices"
  ADD COLUMN "push_token_ciphertext" TEXT,
  ADD COLUMN "push_token_fingerprint" TEXT,
  ADD COLUMN "push_token_key_version" INTEGER,
  ADD COLUMN "push_environment" "PushEnvironment",
  ADD COLUMN "notification_delivery_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "push_token_updated_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "devices_push_token_fingerprint_key"
  ON "devices"("push_token_fingerprint");

CREATE TABLE "notification_preferences" (
  "user_id" TEXT NOT NULL,
  "yearly_renewal_enabled" BOOLEAN NOT NULL DEFAULT false,
  "monthly_renewal_enabled" BOOLEAN NOT NULL DEFAULT false,
  "sync_failure_enabled" BOOLEAN NOT NULL DEFAULT false,
  "new_sign_in_push_enabled" BOOLEAN NOT NULL DEFAULT true,
  "prompt_dismissed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "notification_notices" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "template_key" TEXT NOT NULL,
  "safe_arguments" JSONB,
  "event_at" TIMESTAMP(3) NOT NULL,
  "read_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_notices_user_id_event_at_idx"
  ON "notification_notices"("user_id", "event_at");
CREATE UNIQUE INDEX "notification_notices_event_id_key"
  ON "notification_notices"("event_id");
CREATE INDEX "notification_notices_expires_at_idx"
  ON "notification_notices"("expires_at");

CREATE TABLE "notification_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "template_key" TEXT NOT NULL,
  "safe_arguments" JSONB,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_events_idempotency_key_key"
  ON "notification_events"("idempotency_key");
CREATE INDEX "notification_events_available_at_idx"
  ON "notification_events"("available_at");

CREATE TABLE "notification_deliveries" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "target_key" TEXT NOT NULL,
  "device_id" TEXT,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_expires_at" TIMESTAMP(3),
  "error_class" TEXT,
  "provider_message_id" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_deliveries_event_id_channel_target_key_key"
  ON "notification_deliveries"("event_id", "channel", "target_key");
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx"
  ON "notification_deliveries"("status", "next_attempt_at");
CREATE INDEX "notification_deliveries_lease_expires_at_idx"
  ON "notification_deliveries"("lease_expires_at");
CREATE INDEX "notification_deliveries_user_id_created_at_idx"
  ON "notification_deliveries"("user_id", "created_at");

CREATE TABLE "safety_broadcasts" (
  "id" TEXT NOT NULL,
  "incident_id" TEXT NOT NULL,
  "template_key" TEXT NOT NULL,
  "status" "SafetyBroadcastStatus" NOT NULL,
  "previewed_at" TIMESTAMP(3) NOT NULL,
  "confirmed_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "safety_broadcasts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "safety_broadcasts_incident_id_key"
  ON "safety_broadcasts"("incident_id");

ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_notices"
  ADD CONSTRAINT "notification_notices_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_notices"
  ADD CONSTRAINT "notification_notices_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_events"
  ADD CONSTRAINT "notification_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
