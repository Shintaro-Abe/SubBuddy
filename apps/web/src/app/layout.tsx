import type { Metadata } from "next";
import {
  Geist_Mono,
  Shippori_Mincho,
  Zen_Kaku_Gothic_New,
  BIZ_UDPGothic,
  EB_Garamond,
} from "next/font/google";
import "./globals.css";

// 和文フォント（design.css / DESIGN.md の4段タイプスケールに対応）。
// 日本語フォントは preload できないため preload:false（next/font の制約）。
const sansJp = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
  variable: "--font-sans-jp", // 本文・見出し・キャプション
});
const mincho = Shippori_Mincho({
  weight: "600",
  display: "swap",
  preload: false,
  variable: "--font-mincho", // 大見出し（明朝はここだけ）
});
const numFont = BIZ_UDPGothic({
  weight: ["400", "700"],
  display: "swap",
  preload: false,
  variable: "--font-num", // 金額・件数（tabular）
});

// 欧文フォールバック。
const ebGaramond = EB_Garamond({
  weight: "600",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lat", // 大見出しの欧文/数字
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "SubBuddy",
  description: "サブスクの継続/解約をルールベースで提案するローカルファースト管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${sansJp.variable} ${mincho.variable} ${numFont.variable} ${ebGaramond.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
