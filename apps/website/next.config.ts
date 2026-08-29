import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
  |--------------------------------------------------------------------------
  | Development Origins
  |--------------------------------------------------------------------------
  |
  | Allow both local development hostnames.
  |
  | This prevents Next.js from rejecting internal development resources
  | such as:
  |
  | /_next/static/*
  | /_next/hmr
  |
  | when the website is opened using 127.0.0.1 instead of localhost.
  |
  */

  allowedDevOrigins: ["127.0.0.1", "localhost"],

  /*
  |--------------------------------------------------------------------------
  | Turbopack
  |--------------------------------------------------------------------------
  */

  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
