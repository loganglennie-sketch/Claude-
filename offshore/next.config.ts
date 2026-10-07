import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app sits in a folder inside the timesheet app's project: build only this folder.
  turbopack: { root: __dirname },
  async headers() {
    return [
      {
        // The offline helper must never be cached, so phones always get the latest version.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
