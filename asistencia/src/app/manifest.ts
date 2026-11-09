import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Asistencia — Control de fichadas",
    short_name: "Asistencia",
    description: "Registrá tu entrada y salida desde tu lugar de trabajo.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0d12",
    theme_color: "#2453e0",
    lang: "es-AR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
