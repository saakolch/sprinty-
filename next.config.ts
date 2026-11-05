import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Playwright and phone-on-LAN testing both hit the dev server by IP.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
