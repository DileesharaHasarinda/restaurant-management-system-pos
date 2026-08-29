import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.3"],

  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
