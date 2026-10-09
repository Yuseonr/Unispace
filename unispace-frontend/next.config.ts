import type { NextConfig } from "next";

const configuredBackendUrl = process.env.BACKEND_API_URL?.trim();
const backendUrl = new URL(configuredBackendUrl ?? "http://localhost:3001");
const backendApiOrigin = configuredBackendUrl ? backendUrl.origin : undefined;

if (process.env.VERCEL === "1" && !backendApiOrigin) {
  throw new Error("BACKEND_API_URL must be set in Vercel project settings.");
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: backendUrl.protocol.slice(0, -1) as "http" | "https",
        hostname: backendUrl.hostname,
        port: backendUrl.port,
        pathname: "/api/v1/**",
      },
    ],
  },
  async rewrites() {
    if (!backendApiOrigin) return [];

    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendApiOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
