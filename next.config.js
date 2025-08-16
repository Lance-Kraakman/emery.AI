/** @type {import('next').NextConfig} */
const nextConfig = {
  // AIDEV-NOTE: Removed standalone mode to fix postgres-js Docker compatibility
  // AIDEV-NOTE: Removed env config to allow runtime environment variable loading
  // App router is now stable in Next.js 15
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...config.externals, 'unpdf', '@z-skip/protoc', 'canvas']
    }
    return config
  },
}

module.exports = nextConfig
