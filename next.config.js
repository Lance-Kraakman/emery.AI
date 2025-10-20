/** @type {import('next').NextConfig} */
const nextConfig = {
  // AIDEV-NOTE: Disable standalone mode to speed up builds - use regular node_modules copy
  // output: 'standalone',
  // AIDEV-NOTE: Removed env config to allow runtime environment variable loading
  // App router is now stable in Next.js 15
  // instrumentation.ts is enabled by default in Next.js 15

  // Modern Next.js approach for native modules - replaces complex webpack externals
  serverExternalPackages: [
    '@duckdb/node-api',
    'unpdf',
    '@z-skip/protoc',
    'canvas'
  ],
  
  webpack: (config, { isServer }) => {
    // Externalize native modules from webpack bundling
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(
        '@duckdb/node-api',
        'mock-aws-s3'
      );
    }

    // AIDEV-NOTE: Provide React globally to fix "React is not defined" in both SSR and client chunks
    // This fixes webpack chunks that use React under different aliases (like 'cz')
    const webpack = require('webpack');
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.ProvidePlugin({
        React: 'react',
        cz: 'react'
      })
    );

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
