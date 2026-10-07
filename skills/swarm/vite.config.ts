import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The page builds to dist/, served by swarm's own server (src/server). During page
// development, `npm run dev` proxies the API and the SSE to a running `swarm serve` on 4322.
export default defineConfig({
  root: "app",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    proxy: {
      "/api": "http://localhost:4322",
      "/events": "http://localhost:4322",
    },
  },
  test: {
    environment: "jsdom",
    // the page as the swarm server serves it
    environmentOptions: { jsdom: { url: "http://localhost:4322/" } },
    include: ["**/*.test.tsx"],
  },
});
