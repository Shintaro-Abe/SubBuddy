import Link from "next/link";
import { SidebarNav } from "@/components/SidebarNav";
import { MobileNavigation } from "@/components/MobileNavigation";

/**
 * ダッシュボード共通シェル（サイドバー）。全画面で共通の左ナビを提供する。
 * 見た目は design.css（.app/.side/.main）準拠。現在地ハイライトは SidebarNav（client）。
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <aside className="side">
        <Link href="/" className="brand">
          SubBuddy
        </Link>
        <SidebarNav />
        <div className="spacer" />
        <Link href="/subscriptions/new" className="btn block">
          ＋ サブスクを登録
        </Link>
      </aside>
      <MobileNavigation />
      <main className="main">{children}</main>
    </div>
  );
}
