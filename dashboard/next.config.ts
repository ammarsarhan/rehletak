import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local development runs on https://admin.local.rehletak.app and https://dashboard.local.rehletak.app (see the README),
  // and Next only serves its dev assets to localhost unless told otherwise.
  allowedDevOrigins: ["*.local.rehletak.app"],
};

export default nextConfig;
