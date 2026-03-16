import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Persoonlijke Coach",
    short_name: "AI Coach",
    description: "Jouw gepersonaliseerde AI-coach voor ADHD, taken en leven in balans",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0f1419",
    theme_color: "#0f1419",
    icons: [
      {
        src: "/api/pwa/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa/icon/512?maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

