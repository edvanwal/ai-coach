/** @type {import('next').NextConfig} */
const nextConfig = {
  // Geen caching voor app-pagina's (geen oude stem, oude data)
  headers: async () => [
    {
      source: "/",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        { key: "Pragma", value: "no-cache" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    },
    {
      source: "/api/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        { key: "Pragma", value: "no-cache" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    },
  ],
};

module.exports = nextConfig;
