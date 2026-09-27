import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets the e2e dev server run alongside a normal one
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["better-sqlite3", "sharp", "heic-convert", "archiver"],
  experimental: {
    serverActions: { bodySizeLimit: "40mb" },
  },
};

export default nextConfig;
