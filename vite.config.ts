import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/projects/tariff-wars/", // Set back to subdirectory path
  plugins: [react(), tailwindcss()],
  // Tailwind v4 CSS is handled entirely by the @tailwindcss/vite plugin above,
  // no PostCSS config file is needed. An inline (empty) config here stops
  // Vite's PostCSS loader from searching parent directories for a
  // postcss.config.js — this repo lives in a worktree nested under the main
  // checkout, which still has a stale v3-era postcss.config.js.
  css: { postcss: { plugins: [] } },
  // Dev only: `vite dev` has no API of its own, so every request the app makes
  // 404'd and the UI could not be exercised locally at all. The backend accepts
  // this prefix directly, so no rewrite is needed.
  server: {
    proxy: {
      "/projects/tariff-wars/api": {
        target: process.env.API_ORIGIN || "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
