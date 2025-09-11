/** @type {import('next').NextConfig} */
const nextConfig = {
  // AIDEV-NOTE: Force standalone mode to prevent static generation
  output: 'standalone',
  
  // AIDEV-NOTE: Completely disable static generation
  trailingSlash: false,
  generateBuildId: () => 'build',
  
  // Disable all static optimization
  experimental: {
    esmExternals: 'loose', // Handle ESM imports better
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
    // Exclude TipTap and TanStack packages from server bundling
    '@tiptap/react',
    '@tiptap/starter-kit',
    '@tiptap/extension-placeholder',
    '@tiptap/extension-link',
    '@tiptap/extension-image',
    '@tiptap/extension-table',
    '@tiptap/extension-table-row',
    '@tiptap/extension-table-header',
    '@tiptap/extension-table-cell',
    '@tanstack/react-form',
    '@tanstack/react-query',
    '@tanstack/react-store',
    '@tanstack/react-table',
    // AIDEV-NOTE: Temporarily removed LlamaIndex packages from externals
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
    
    // Disable problematic optimizations
    config.optimization = config.optimization || {};
    config.optimization.usedExports = false;
    config.optimization.sideEffects = false;
    
    return config
  },
  
  // Disable static generation completely
  onDemandEntries: {
    maxInactiveAge: 0,
    pagesBufferLength: 0,
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
