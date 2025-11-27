/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : null

const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage
      ...(supabaseHostname
        ? [
            {
              protocol: 'https',
              hostname: supabaseHostname,
            },
          ]
        : []),
      // Images externes (toutes les URLs https)
      {
        protocol: 'https',
        hostname: '**',
      },
      // Images externes (toutes les URLs http)
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig

