import type { NotificationKind } from "@prisma/client";

type NoticeTemplate = {
  title: string;
  body: string;
};

export const notificationTemplates: Record<string, NoticeTemplate> = {
  renewal_reminder: {
    title: "更新日を確認しましょう",
    body: "更新日が近い契約があります。",
  },
  sync_failure: {
    title: "同期を確認してください",
    body: "同期できていない記録があります。",
  },
  new_sign_in: {
    title: "サインインを確認してください",
    body: "新しい端末またはブラウザからサインインがありました。",
  },
  account_deletion_scheduled: {
    title: "重要なお知らせがあります",
    body: "アカウントに関する重要なお知らせを確認してください。",
  },
  safety_incident: {
    title: "重要なお知らせがあります",
    body: "安全性またはサービス状況に関するお知らせを確認してください。",
  },
};

export function templateFor(kind: NotificationKind): NoticeTemplate {
  const template = notificationTemplates[kind];
  if (!template) throw new Error("unsupported notification template");
  return template;
}
