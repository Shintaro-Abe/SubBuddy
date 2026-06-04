import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/user";
import { getSubscription } from "@/repositories/subscriptions";
import { SubscriptionForm } from "@/components/SubscriptionForm";

export const dynamic = "force-dynamic";

export default async function EditSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await getSubscription(getCurrentUserId(), id);
  if (!s) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">サブスクを編集</h1>
      <SubscriptionForm
        id={s.id}
        initial={{
          name: s.name,
          category: s.category,
          amount: s.amount,
          billingCycle: s.billingCycle,
          nextRenewalDate: s.nextRenewalDate
            ? s.nextRenewalDate.toISOString().slice(0, 10)
            : "",
          importance: s.importance,
          cancellationUrl: s.cancellationUrl ?? "",
          notes: s.notes ?? "",
          status: s.status,
        }}
      />
    </div>
  );
}
