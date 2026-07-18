import { PrismaClient } from "@prisma/client";
import { syncServiceCatalog } from "../src/services/service-catalog-bootstrap";

const prisma = new PrismaClient();

syncServiceCatalog(prisma)
  .then((result) => {
    console.log("service catalog synced:", result);
  })
  .catch(() => {
    console.error("service catalog sync failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
