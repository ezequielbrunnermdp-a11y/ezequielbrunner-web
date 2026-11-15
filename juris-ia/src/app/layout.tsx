import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JURIS IA — Inteligencia judicial",
  description: "Estudio y análisis de expedientes judiciales de la Provincia de Buenos Aires con IA y citas verificables.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:wght@500;600&display=swap" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
