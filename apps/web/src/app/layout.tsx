import type { Metadata } from "next";
import "./globals.css";

const googleFontsHref =
  "https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=EB+Garamond:wght@600&family=Geist+Mono:wght@400;500;700&family=Shippori+Mincho:wght@600&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap";

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
        <link rel="stylesheet" href={googleFontsHref} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
