/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow next/image to optimize images from Supabase Storage.
    // Covers both listing images (/storage/v1/object/public/**) and
    // avatar URLs which may come from the same bucket.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Serve optimized images as WebP. next/image resizes to the `sizes`
    // attribute declared on each <Image> — cutting egress 60-80% vs raw uploads.
    formats: ['image/webp'],
    // Serve device-appropriate sizes. These match the `sizes` props used across
    // the app: 22px avatars, 36-64px leaderboard avatars, card images up to ~400px.
    deviceSizes: [390, 768, 1024, 1280, 1440],
    imageSizes: [22, 36, 48, 64, 96, 160, 400],
  },
  serverExternalPackages: [],
}

module.exports = nextConfig
