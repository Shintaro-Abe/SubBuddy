export type GuidanceStepKey = "inventory" | "spending" | "review" | "measurement";

export type GuidanceProgress = {
  steps: Record<GuidanceStepKey, boolean>;
  completedCount: number;
  totalCount: 4;
  nextStep: GuidanceStepKey | null;
  isComplete: boolean;
  measurementChoice: "pending" | "configured" | "skipped";
};

export const GUIDANCE_STEPS: Array<{
  key: GuidanceStepKey;
  title: string;
  description: string;
  href: string;
  action: string;
}> = [
  {
    key: "inventory",
    title: "契約を棚卸しする",
    description: "契約中のサブスクを、思い出せる範囲から登録します。",
    href: "/subscriptions",
    action: "契約を確認",
  },
  {
    key: "spending",
    title: "支出と更新日を見る",
    description: "登録した契約の月額・年額と、更新日を確認します。",
    href: "/spending",
    action: "支出を見る",
  },
  {
    key: "review",
    title: "見直す理由を見る",
    description: "分かっている事実、不足情報、選択肢を確認します。",
    href: "/recommendations",
    action: "見直しを見る",
  },
  {
    key: "measurement",
    title: "必要なら利用状況を加える",
    description: "iPhoneで設定できます。使わなくても料金や更新日から見直せます。",
    href: "/getting-started#measurement",
    action: "説明を見る",
  },
];
