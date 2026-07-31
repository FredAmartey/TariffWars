/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/projects/tariff-wars/", // Set back to subdirectory path
  plugins: [react()],
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
  test: {
    environment: "jsdom",
    globals: true,
    include: ["frontend/test/**/*.test.ts"],
  },
});
