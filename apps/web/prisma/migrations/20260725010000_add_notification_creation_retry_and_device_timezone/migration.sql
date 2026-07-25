CREATE TYPE "NotificationCreationStatus" AS ENUM (
  'pending',
  'processing',
  'retryable_failure',
  'completed'
);

ALTER TABLE "devices"
  ADD COLUMN "time_zone" TEXT;

CREATE TABLE "notification_creation_tasks" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "template_key" TEXT NOT NULL,
  "safe_arguments" JSONB,
  "exclude_device_id" TEXT,
  "event_at" TIMESTAMP(3) NOT NULL,
  "status" "NotificationCreationStatus" NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_expires_at" TIMESTAMP(3),
  "error_class" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_creation_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_creation_tasks_idempotency_key_key"
  ON "notification_creation_tasks"("idempotency_key");
CREATE INDEX "notification_creation_tasks_status_next_attempt_at_idx"
  ON "notification_creation_tasks"("status", "next_attempt_at");
CREATE INDEX "notification_creation_tasks_lease_expires_at_idx"
  ON "notification_creation_tasks"("lease_expires_at");
CREATE INDEX "notification_creation_tasks_user_id_created_at_idx"
  ON "notification_creation_tasks"("user_id", "created_at");

ALTER TABLE "notification_creation_tasks"
  ADD CONSTRAINT "notification_creation_tasks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
