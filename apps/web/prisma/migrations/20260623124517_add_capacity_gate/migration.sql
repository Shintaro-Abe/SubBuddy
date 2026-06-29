-- AlterTable
ALTER TABLE "service_plans" ADD COLUMN     "capacity_gb" INTEGER;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "capacity_checked_at" TIMESTAMP(3),
ADD COLUMN     "plan_capacity_gb" INTEGER,
ADD COLUMN     "used_capacity_gb" INTEGER;
