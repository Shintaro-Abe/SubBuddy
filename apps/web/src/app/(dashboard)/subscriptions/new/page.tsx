import { SubscriptionForm } from "@/components/SubscriptionForm";

export default function NewSubscriptionPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">サブスクを登録</h1>
      <SubscriptionForm />
    </div>
  );
}
