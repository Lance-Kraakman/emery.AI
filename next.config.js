/** @type {import('next').NextConfig} */
const nextConfig = {
  // AIDEV-NOTE: Disable standalone mode to speed up builds - use regular node_modules copy
  // output: 'standalone',
  // AIDEV-NOTE: Removed env config to allow runtime environment variable loading
  // App router is now stable in Next.js 15
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...config.externals, 'unpdf', '@z-skip/protoc', 'canvas']
    }
    return config
  },
  
  // gRPC-Web proxy configuration
  async rewrites() {
    return [
      {
        // Proxy gRPC-Web requests to Python gRPC server
        source: '/grpc/:path*',
        destination: 'http://localhost:50051/:path*',
      },
    ]
  },
}

module.exports = nextConfig
