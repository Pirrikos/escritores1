/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Permite compilar aunque existan warnings de ESLint
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Configuración específica para Vercel y PDF.js
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    // Configuración para PDF.js worker en Vercel
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
      };
    }
    return config;
  },
  // Headers para permitir workers y WASM
  async headers() {
    // Evitar cabeceras COEP/COOP en desarrollo para compatibilidad con webviews/iframes
    if (process.env.NODE_ENV !== 'production') {
      return [];
    }
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};
export default nextConfig;
