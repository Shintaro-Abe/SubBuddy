import { GettingStartedChecklist } from "@/components/GettingStartedChecklist";
import { requireServerUserId } from "@/lib/server-auth";
import { countUserSubscriptions } from "@/repositories/guidance-progress";
import { getResolvedGuidanceProgress } from "@/services/guidance-progress";

export const dynamic = "force-dynamic";

export default async function GettingStartedPage() {
  const userId = await requireServerUserId();
  const [progress, subscriptionCount] = await Promise.all([
    getResolvedGuidanceProgress(userId),
    countUserSubscriptions(userId),
  ]);

  return (
    <div>
      <p className="display">使い方</p>
      <p className="caption mt-2">次にすることと、各画面の役割をいつでも確認できます。</p>
      <GettingStartedChecklist progress={progress} subscriptionCount={subscriptionCount} />

      <section id="measurement" className="section panel scroll-mt-6">
        <h2 className="title">利用状況の計測について</h2>
        <p className="body mt-2">
          利用状況の計測はiPhoneアプリで設定できます。使った日と時間帯の目安だけを見直しに使い、詳しい操作内容は送りません。
        </p>
        <p className="body mt-2">
          設定しなくても、料金、更新日、重複、プラン情報による見直しを利用できます。
        </p>
      </section>
    </div>
  );
}
