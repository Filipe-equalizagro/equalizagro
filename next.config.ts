import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async redirects() {
    return [
      {
        source: '/ferramentas/go2apply',
        destination: '/pulverizacao/go2apply',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
