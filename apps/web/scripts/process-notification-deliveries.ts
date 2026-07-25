import { processNotificationDeliveries } from "../src/services/notification-delivery/processor";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await processNotificationDeliveries();
  process.stdout.write(
    JSON.stringify({
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      disabled: result.disabled,
    }) + "\n",
  );
}

void main()
  .catch(() => {
    process.stderr.write("notification delivery command failed\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
