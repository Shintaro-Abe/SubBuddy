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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
