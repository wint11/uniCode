import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "uniCode - 企业级文档管理系统",
  description: "Doc as Code · 文档治理 · AI 协同",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
