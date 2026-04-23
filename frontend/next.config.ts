import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/unified/:path*",
        destination: "http://localhost:8000/api/unified/:path*",
      },
    ];
  },
};

export default nextConfig;
