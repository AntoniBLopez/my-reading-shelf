import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { onPwaNeedReload, startPwaAutoReload } from "@/lib/pwaAutoReload";
import { onRegisteredServiceWorker } from "@/lib/pwaUpdate";
import App from "./App.tsx";
import "./index.css";

if (import.meta.env.PROD) {
  // Capture the current controller, then listen, before registerSW can claim.
  startPwaAutoReload();
  registerSW({
    immediate: true,
    onNeedReload: onPwaNeedReload,
    onRegisteredSW: onRegisteredServiceWorker,
  });
} else if ("serviceWorker" in navigator) {
  // Prevent stale Workbox service workers from intercepting Vite dev requests.
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister();
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
