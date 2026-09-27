import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sharp", "heic-convert", "archiver"],
  experimental: {
    serverActions: { bodySizeLimit: "40mb" },
  },
};

export default nextConfig;
