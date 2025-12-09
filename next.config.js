/** @type {import('next').NextConfig} */
const nextConfig = {
  // AIDEV-NOTE: Disable standalone mode to speed up builds - use regular node_modules copy
  // output: 'standalone',
  // AIDEV-NOTE: Removed env config to allow runtime environment variable loading
  // App router is now stable in Next.js 15

  // AIDEV-NOTE: Consistent build ID for multi-container deployments (prevents version skew)
  generateBuildId: async () => {
    return process.env.GIT_SHA || process.env.BUILD_ID || 'development'
  },

  // Modern Next.js approach for native modules - replaces complex webpack externals
  serverExternalPackages: [
    'duckdb',
    '@duckdb/node-api', 
    '@duckdb/node-bindings',
    '@duckdb/node-bindings-darwin-arm64',
    '@duckdb/node-bindings-linux-x64',
    'unpdf', 
    '@z-skip/protoc', 
    'canvas'
  ],
  
  webpack: (config, { isServer }) => {
    // Externalize DuckDB and its dependencies from webpack bundling
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(
        'duckdb',
        '@mapbox/node-pre-gyp',
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

  // AIDEV-NOTE: Enable RSC streaming (disable proxy buffering for ALB/CloudFront)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' }
        ],
      },
    ]
  },
}

module.exports = nextConfig
