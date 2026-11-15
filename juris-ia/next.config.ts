import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Librerías de Node que no deben empaquetarse para el servidor.
  serverExternalPackages: ["pdfjs-dist", "pdfkit", "pg", "mammoth"],
  // Archivos que se leen en tiempo de ejecución y deben viajar con las funciones.
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/pdfjs-dist/legacy/build/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfkit/js/data/**",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};
export default nextConfig;
