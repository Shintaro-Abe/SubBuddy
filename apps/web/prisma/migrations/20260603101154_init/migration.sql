-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'paused', 'canceled');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('keep', 'review', 'consider_downgrade', 'consider_cancel', 'strong_cancel_candidate');

-- CreateEnum
CREATE TYPE "DataStatus" AS ENUM ('observing', 'ready');

-- CreateEnum
CREATE TYPE "UsageBucket" AS ENUM ('none', 'm1_plus', 'm5_plus', 'm15_plus', 'm30_plus', 'm60_plus', 'm120_plus');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JPY',
    "billing_cycle" "BillingCycle" NOT NULL,
    "next_renewal_date" DATE,
    "signup_channel" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "importance" INTEGER NOT NULL DEFAULT 3,
    "cancellation_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "service_name_raw" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JPY',
    "charged_at" TIMESTAMP(3) NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "raw_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ios_usage_daily_summaries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "usage_date" DATE NOT NULL,
    "used" BOOLEAN NOT NULL,
    "usage_bucket" "UsageBucket" NOT NULL,
    "estimated_minutes_min" INTEGER,
    "estimated_minutes_max" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'ios_device_activity',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ios_usage_daily_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "decision" "Decision",
    "data_status" "DataStatus" NOT NULL,
    "observation_days" INTEGER NOT NULL,
    "days_until_ready" INTEGER NOT NULL,
    "cancel_score" INTEGER NOT NULL,
    "monthly_amount" INTEGER NOT NULL,
    "yearly_amount" INTEGER NOT NULL,
    "usage_days_30d" INTEGER NOT NULL,
    "usage_minutes_30d" INTEGER NOT NULL,
    "days_since_last_use" INTEGER,
    "days_until_renewal" INTEGER,
    "cost_per_usage_day" DOUBLE PRECISION,
    "has_overlap" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "reason" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog" (
    "id" TEXT NOT NULL,
    "canonical_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "domains" TEXT,
    "app_bundle_ids" TEXT,
    "common_aliases" TEXT,
    "cancellation_url" TEXT,
    "is_supported" BOOLEAN NOT NULL DEFAULT true,
    "is_excluded" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_category_idx" ON "subscriptions"("category");

-- CreateIndex
CREATE INDEX "billing_events_subscription_id_idx" ON "billing_events"("subscription_id");

-- CreateIndex
CREATE INDEX "ios_usage_daily_summaries_user_id_idx" ON "ios_usage_daily_summaries"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ios_usage_daily_summaries_subscription_id_usage_date_key" ON "ios_usage_daily_summaries"("subscription_id", "usage_date");

-- CreateIndex
CREATE INDEX "recommendation_snapshots_subscription_id_idx" ON "recommendation_snapshots"("subscription_id");

-- CreateIndex
CREATE INDEX "recommendation_snapshots_user_id_idx" ON "recommendation_snapshots"("user_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ios_usage_daily_summaries" ADD CONSTRAINT "ios_usage_daily_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ios_usage_daily_summaries" ADD CONSTRAINT "ios_usage_daily_summaries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_snapshots" ADD CONSTRAINT "recommendation_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_snapshots" ADD CONSTRAINT "recommendation_snapshots_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
