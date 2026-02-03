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
    'canvas',
    'pdfjs-dist'
  ],

  // Increase Server Actions body size limit from 1MB to 5MB
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
      allowedOrigins: ['dev.enhancd.ai']
    }
  },
  
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
  // AIDEV-NOTE: Security headers applied globally. Individual API routes can override
  // these by setting their own headers in the route handler response.
  async headers() {
    return [
      // Allow preview frames to be embedded (same-origin only for iframe preview)
      {
        source: '/apps/:id/pages/:pageId/preview/frame',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Powered-By', value: '' },
        ],
      },
      // Default security headers for all other routes (excludes preview/frame for iframe embedding)
      {
        source: '/((?!apps/.*?/pages/.*?/preview/frame).*)',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' },
          // Security headers (OWASP recommended)
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Powered-By', value: '' },  // Force remove (Next.js 15 ignores poweredByHeader)
        ],
      },
    ]
  },
  // Remove X-Powered-By header
  poweredByHeader: false,
}

module.exports = nextConfig
