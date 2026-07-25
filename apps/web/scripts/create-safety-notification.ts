import { parseNotificationConfig } from "../src/config/notifications";
import { prisma } from "../src/lib/prisma";
import { createNotificationEvent } from "../src/services/notifications";

function valueAfter(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

async function main() {
  const incidentId = valueAfter("--incident-id");
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  if (!incidentId || !/^[a-z0-9][a-z0-9-]{5,80}$/.test(incidentId)) {
    throw new Error("--incident-id must be a lowercase stable identifier");
  }
  const config = parseNotificationConfig();
  if (!config.enabled) throw new Error("notifications are disabled");

  const users = await prisma.user.findMany({ select: { id: true } });
  const deviceCount = await prisma.device.count({
    where: {
      userId: { in: users.map((user) => user.id) },
      revokedAt: null,
      notificationDeliveryEnabled: true,
      pushTokenCiphertext: { not: null },
    },
  });
  process.stdout.write(
    JSON.stringify({
      mode,
      incidentId,
      template: "safety_incident",
      users: users.length,
      apnsTargets: deviceCount,
    }) + "\n",
  );

  if (mode === "apply") {
    const existing = await prisma.safetyBroadcast.findUnique({ where: { incidentId } });
    if (existing?.status === "completed") {
      throw new Error("this incident was already delivered");
    }
    await prisma.safetyBroadcast.upsert({
      where: { incidentId },
      create: {
        incidentId,
        templateKey: "safety_incident",
        status: "confirmed",
        previewedAt: new Date(),
        confirmedAt: new Date(),
      },
      update: { status: "confirmed", confirmedAt: new Date() },
    });
    for (const user of users) {
      await createNotificationEvent({
        userId: user.id,
        kind: "safety_incident",
        idempotencyKey: `safety:${incidentId}:${user.id}`,
        templateKey: "safety_incident",
      });
    }
    await prisma.safetyBroadcast.update({
      where: { incidentId },
      data: { status: "completed", completedAt: new Date() },
    });
  }
}

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "safety notification command failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
