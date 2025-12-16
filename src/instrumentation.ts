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
}
