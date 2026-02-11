/**
 * Next.js Instrumentation
 *
 * This file runs before any server-side code loads.
 * Used for polyfills and global initialization.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// Type declaration for Promise.withResolvers (ES2024)
declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>
      resolve: (value: T | PromiseLike<T>) => void
      reject: (reason?: any) => void
    }
  }
}

// Polyfill for Promise.withResolvers (ES2024)
// Required by some dependencies (pdfjs-dist, etc.), not available in Node.js < 22
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: any) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

export async function register() {
  // Polyfill runs at import time (above)
  // This export is required for Next.js instrumentation to work

  // Only run on Node.js server runtime, not edge/client
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // AIDEV-NOTE: Graceful shutdown handlers for ECS deployments
    // When ECS sends SIGTERM, we have ~30 seconds to clean up
    // Close database connections, flush caches, etc.
    const shutdown = async (signal: string) => {
      console.log(`[SHUTDOWN] Received ${signal}, starting graceful shutdown...`)

      try {
        // Close database connections
        const { rawClient } = await import('./ddd/infrastructure/db/client')
        await rawClient.end({ timeout: 5 })
        console.log('[SHUTDOWN] Database connections closed')
      } catch (error) {
        console.error('[SHUTDOWN] Error closing database:', error)
      }

      // Allow time for any in-flight requests to complete
      console.log('[SHUTDOWN] Graceful shutdown complete')
      process.exit(0)
    }

    // Handle SIGTERM (ECS sends this) and SIGINT (Ctrl+C)
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  }
}
