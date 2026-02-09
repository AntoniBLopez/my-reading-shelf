import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
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
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
