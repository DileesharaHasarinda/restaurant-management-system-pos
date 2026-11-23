import { defineConfig, loadEnv } from "vite";

import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  if (mode === "production" && !env.VITE_API_BASE_URL) {
    throw new Error(
      "VITE_API_BASE_URL must be set for production builds (see .env.example)."
    );
  }

  return {
    plugins: [react()],

    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",

          changeOrigin: true,
        },
      },
    },
  };
});
