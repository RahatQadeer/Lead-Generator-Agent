import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["playwright", "playwright-core"],
  async redirects() {
    return [
      {
        source: "/search-builder",
        destination: "/searches",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
