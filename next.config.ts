import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/onlyoffice/:path*",
        destination:
          "https://onlyoffice.yellowbeach-b376b925.southeastasia.azurecontainerapps.io/:path*",
      },
    ];
  },
};

export default nextConfig;
