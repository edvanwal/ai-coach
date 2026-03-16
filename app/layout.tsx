import type { Metadata } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const viewport = {
  themeColor: "#0f1419",
};

export const metadata: Metadata = {
  title: "AI Persoonlijke Coach",
  description: "Jouw gepersonaliseerde AI-coach voor ADHD, taken en leven in balans",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
