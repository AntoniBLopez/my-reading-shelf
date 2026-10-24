import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      void registration?.update();
    },
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
