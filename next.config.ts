import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async redirects() {
    return [
      {
        source: '/ferramentas/go2apply',
        destination: '/pulverizacao',
        permanent: true,
      },
      // Compatibilidade com links/favoritos antigos
      {
        source: '/dashboard',
        destination: '/go2apply',
        permanent: true,
      },
      {
        source: '/pulverizacao/go2apply',
        destination: '/pulverizacao',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
