import Link from "next/link";

/**
 * ダッシュボード共通シェル（ナビ）。全画面で共通のヘッダーを提供する。
 */
const NAV = [
  { href: "/", label: "ダッシュボード" },
  { href: "/subscriptions", label: "サブスク一覧" },
  { href: "/spending", label: "支出の可視化" },
  { href: "/recommendations", label: "レコメンド" },
  { href: "/renewals", label: "更新間近" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            SubBuddy
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-zinc-900">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
