import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/projects/tariff-wars/", // Set back to subdirectory path
  plugins: [react()],
});
