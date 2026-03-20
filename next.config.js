/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // Suppress the ESM/CJS warning — Next.js 14 handles this internally
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

module.exports = nextConfig
