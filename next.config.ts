import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 原生模块不可被 Turbopack 打包，必须外置
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
