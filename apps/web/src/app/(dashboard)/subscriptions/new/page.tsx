import { SubscriptionForm } from "@/components/SubscriptionForm";

export default function NewSubscriptionPage() {
  return (
    <div>
      <div className="pagehead">
        <p className="display">サブスクを登録</p>
        <p className="caption" style={{ marginTop: 8 }}>
          まずは1件。あとから編集できます。
        </p>
      </div>
      <SubscriptionForm />
    </div>
  );
}
