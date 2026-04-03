import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
// VITE_BASE_PATH: set to "/" for Vercel (root); unset for GitHub Pages (/my-reading-shelf/)
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/my-reading-shelf/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Keep service worker off in local dev to avoid noisy Workbox routing warnings.
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        // Include .mjs so pdf.js worker chunks are precached and PDF opens offline.
        globPatterns: ["**/*.{js,mjs,css,html,ico,png,svg,webmanifest}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
