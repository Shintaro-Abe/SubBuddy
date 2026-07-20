CREATE TYPE "GuidanceMeasurementChoice" AS ENUM ('pending', 'configured', 'skipped');

CREATE TABLE "user_guidance_progress" (
    "user_id" TEXT NOT NULL,
    "inventory_completed_at" TIMESTAMP(3),
    "spending_viewed_at" TIMESTAMP(3),
    "review_viewed_at" TIMESTAMP(3),
    "measurement_choice" "GuidanceMeasurementChoice" NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_guidance_progress_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "user_guidance_progress"
ADD CONSTRAINT "user_guidance_progress_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
