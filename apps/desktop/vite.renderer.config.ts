import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/*
 * Content-Security-Policy for packaged builds only. The dev server needs
 * inline scripts (React refresh), so the meta tag is injected at build time.
 * connect-src stays open to http(s)/ws(s) because the API and Reverb hosts
 * are configurable per deployment.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http: https:",
  "font-src 'self' data:",
  "connect-src 'self' http: https: ws: wss:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const injectCsp = (): Plugin => ({
  name: "inject-csp",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      attrs: { "http-equiv": "Content-Security-Policy", content: csp },
      injectTo: "head-prepend",
    },
  ],
});

export default defineConfig({
  plugins: [react(), injectCsp()],
});
