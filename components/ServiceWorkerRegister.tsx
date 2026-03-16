"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // We registreren altijd; service worker zelf is “veilig” (geen API caching).
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // stil falen: PWA is optioneel
    });
  }, []);

  return null;
}

