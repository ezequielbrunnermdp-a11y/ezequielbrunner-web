import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Librerías de Node que no deben empaquetarse para el servidor.
  serverExternalPackages: ["pdfjs-dist", "pdfkit", "pg", "mammoth"],
  experimental: { serverActions: { bodySizeLimit: "60mb" } },
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
