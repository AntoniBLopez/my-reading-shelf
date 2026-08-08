import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "path";

const require = createRequire(import.meta.url);

function resolvePdfjsWasmDir(): string {
  try {
    return path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "wasm");
  } catch {
    const pnpmRoot = path.join(process.cwd(), "node_modules", ".pnpm");
    if (!fs.existsSync(pnpmRoot)) {
      throw new Error("Unable to locate pdfjs-dist/wasm (pdfjs-dist not installed)");
    }
    const match = fs.readdirSync(pnpmRoot).find((name) => name.startsWith("pdfjs-dist@"));
    if (!match) {
      throw new Error("Unable to locate pdfjs-dist/wasm under node_modules/.pnpm");
    }
    return path.join(pnpmRoot, match, "node_modules", "pdfjs-dist", "wasm");
  }
}

/** Serve/copy pdf.js OpenJPEG wasm so JPEG2000-scanned PDFs render (e.g. many Gutenberg books). */
function pdfjsWasm(): Plugin {
  let outDir = "dist";
  let basePath = "/";
  let pdfjsWasmDir = "";

  const resolveUrlPath = (rawUrl: string | undefined) => {
    const url = (rawUrl ?? "").split("?")[0];
    const normalizedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
    if (normalizedBase && url.startsWith(normalizedBase)) {
      return url.slice(normalizedBase.length) || "/";
    }
    return url;
  };

  return {
    name: "pdfjs-wasm",
    configResolved(config) {
      outDir = config.build.outDir;
      basePath = config.base || "/";
      pdfjsWasmDir = resolvePdfjsWasmDir();
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = resolveUrlPath(req.url);
        if (!urlPath.startsWith("/wasm/")) {
          next();
          return;
        }
        const relative = decodeURIComponent(urlPath.slice("/wasm/".length));
        const filePath = path.join(pdfjsWasmDir, relative);
        if (!filePath.startsWith(pdfjsWasmDir) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          next();
          return;
        }
        if (filePath.endsWith(".wasm")) res.setHeader("Content-Type", "application/wasm");
        else if (filePath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript");
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      const target = path.resolve(outDir, "wasm");
      fs.mkdirSync(target, { recursive: true });
      fs.cpSync(pdfjsWasmDir, target, { recursive: true });
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
    pdfjsWasm(),
    VitePWA({
      registerType: "autoUpdate",
      // Keep service worker off in local dev to avoid noisy Workbox routing warnings.
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        // Include .mjs/.wasm so pdf.js worker + OpenJPEG decode work offline.
        globPatterns: ["**/*.{js,mjs,css,html,ico,png,svg,webmanifest,wasm}"],
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
