import { MetadataRoute } from 'next'

/**
 * Robots.txt configuration for crawler protection.
 *
 * Blocks AI training crawlers and restricts access to API/auth routes.
 * WAF handles rate limiting at the edge (see infra/infra/waf_stack.py).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default rule - allow most crawlers but block sensitive paths
      {
        userAgent: '*',
        disallow: ['/api/', '/auth/', '/_next/', '/admin/'],
      },
      // Block AI training crawlers
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'Google-Extended',
        disallow: '/',
      },
      {
        userAgent: 'anthropic-ai',
        disallow: '/',
      },
      {
        userAgent: 'Claude-Web',
        disallow: '/',
      },
      {
        userAgent: 'Bytespider',
        disallow: '/',
      },
      {
        userAgent: 'cohere-ai',
        disallow: '/',
      },
    ],
  }
}
