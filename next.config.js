/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // App router is now stable in Next.js 15
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...config.externals, 'unpdf', '@z-skip/protoc', 'canvas']
    }
    return config
  },
}

module.exports = nextConfig
