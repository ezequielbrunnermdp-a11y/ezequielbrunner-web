import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeScript } from "@/components/theme";
import { SwRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: { default: "Asistencia", template: "%s · Asistencia" },
  description: "Control de asistencia y fichaje con validación de ubicación.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Asistencia", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
