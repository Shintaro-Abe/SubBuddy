-- AlterTable
ALTER TABLE "service_catalog" ADD COLUMN     "usage_type" TEXT NOT NULL DEFAULT 'active_foreground';

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "initial_value_answer" TEXT,
ADD COLUMN     "matched_service_id" TEXT,
ADD COLUMN     "usage_type" TEXT NOT NULL DEFAULT 'active_foreground';

-- CreateTable
CREATE TABLE "service_plans" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_price" INTEGER NOT NULL,
    "is_free_tier" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3) NOT NULL,
    "source_url" TEXT,

    CONSTRAINT "service_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_alternatives" (
    "id" TEXT NOT NULL,
    "from_service_id" TEXT NOT NULL,
    "to_service_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'same_category',

    CONSTRAINT "service_alternatives_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "service_plans" ADD CONSTRAINT "service_plans_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_alternatives" ADD CONSTRAINT "service_alternatives_from_service_id_fkey" FOREIGN KEY ("from_service_id") REFERENCES "service_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
