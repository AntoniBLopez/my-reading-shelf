import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "path";

const require = createRequire(import.meta.url);

function pdfjsPackageDir(): string {
  try {
    return path.dirname(require.resolve("pdfjs-dist/package.json"));
  } catch {
    const pnpmRoot = path.join(process.cwd(), "node_modules", ".pnpm");
    if (!fs.existsSync(pnpmRoot)) {
      throw new Error("Unable to locate pdfjs-dist (package not installed)");
    }
    const match = fs.readdirSync(pnpmRoot).find((name) => name.startsWith("pdfjs-dist@"));
    if (!match) throw new Error("Unable to locate pdfjs-dist under node_modules/.pnpm");
    return path.join(pnpmRoot, match, "node_modules", "pdfjs-dist");
  }
}

const PDFJS_ASSETS = [
  { url: "/wasm/", dir: "wasm" },
  { url: "/cmaps/", dir: "cmaps" },
  { url: "/standard_fonts/", dir: "standard_fonts" },
] as const;

function contentType(filePath: string): string | null {
  if (filePath.endsWith(".wasm")) return "application/wasm";
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".pfb") || filePath.endsWith(".ttf")) return "font/ttf";
  if (filePath.endsWith(".bcmap")) return "application/octet-stream";
  return null;
}

/** Serve pdf.js wasm, CMaps, and standard fonts so text extraction works offline. */
function pdfjsAssets(): Plugin {
  let outDir = "dist";
  let basePath = "/";
  let packageDir = "";

  const resolveUrlPath = (rawUrl: string | undefined) => {
    const url = (rawUrl ?? "").split("?")[0];
    const normalizedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
    if (normalizedBase && url.startsWith(normalizedBase)) {
      return url.slice(normalizedBase.length) || "/";
    }
    return url;
  };

  return {
    name: "pdfjs-assets",
    configResolved(config) {
      outDir = config.build.outDir;
      basePath = config.base || "/";
      packageDir = pdfjsPackageDir();
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = resolveUrlPath(req.url);
        const asset = PDFJS_ASSETS.find((entry) => urlPath.startsWith(entry.url));
        if (!asset) {
          next();
          return;
        }
        const root = path.join(packageDir, asset.dir);
        const relative = decodeURIComponent(urlPath.slice(asset.url.length));
        const filePath = path.join(root, relative);
        if (!filePath.startsWith(root) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          next();
          return;
        }
        const type = contentType(filePath);
        if (type) res.setHeader("Content-Type", type);
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      for (const asset of PDFJS_ASSETS) {
        const target = path.resolve(outDir, asset.dir);
        fs.mkdirSync(target, { recursive: true });
        fs.cpSync(path.join(packageDir, asset.dir), target, { recursive: true });
      }
    },
  };
}

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
    pdfjsAssets(),
    VitePWA({
      registerType: "autoUpdate",
      // Keep service worker off in local dev to avoid noisy Workbox routing warnings.
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        // Include .mjs/.wasm so pdf.js worker + OpenJPEG decode work offline.
        globPatterns: ["**/*.{js,mjs,css,html,ico,png,svg,webmanifest,wasm,bcmap,pfb,ttf}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
