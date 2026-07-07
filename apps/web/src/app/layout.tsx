import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
