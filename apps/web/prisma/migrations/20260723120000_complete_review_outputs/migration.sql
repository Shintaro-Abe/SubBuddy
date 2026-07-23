CREATE TYPE "ReviewPriority" AS ENUM (
  'now',
  'before_renewal',
  'missing_information',
  'low_urgency'
);

ALTER TABLE "recommendation_snapshots"
  ADD COLUMN "review_priority" "ReviewPriority",
  ADD COLUMN "review_unknowns" JSONB,
  ADD COLUMN "review_options" JSONB,
  ADD COLUMN "annual_savings_if_cancelled" INTEGER,
  ADD COLUMN "annual_savings_if_downgraded" INTEGER,
  ADD COLUMN "annual_savings_if_switched" INTEGER,
  ADD COLUMN "source_subscription_updated_at" TIMESTAMP(3);

ALTER TABLE "service_catalog"
  ADD COLUMN "cancellation_url_verified_at" TIMESTAMP(3),
  ADD COLUMN "cancellation_url_source_url" TEXT;

ALTER TABLE "service_alternatives"
  ADD COLUMN "verified_at" TIMESTAMP(3),
  ADD COLUMN "source_url" TEXT;
