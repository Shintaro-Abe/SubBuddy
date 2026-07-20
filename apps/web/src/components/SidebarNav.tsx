"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * サイドバーのナビ（現在地ハイライト用にクライアント側で usePathname を使う）。
 * 行頭は小さな丸ドット（.ic）。アクティブは淡いセージ背景＋太字（.on）。
 */
const NAV = [
  { href: "/", label: "ダッシュボード" },
  { href: "/subscriptions", label: "契約" },
  { href: "/spending", label: "支出の内訳" },
  { href: "/recommendations", label: "見直し" },
  { href: "/renewals", label: "更新間近" },
  { href: "/getting-started", label: "使い方" },
  { href: "/settings", label: "設定" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className={isActive(pathname, n.href) ? "on" : undefined}>
          <span className="ic" />
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
