/**
 * Next.js Instrumentation Hook
 *
 * This runs ONCE when the server starts, before any requests are handled.
 * We use it to eagerly initialize the DI container with DuckDB.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] 🚀 Server starting - initializing DI Container...');

    try {
      // Dynamic imports to avoid loading during build
      const { DIContainer } = await import('./ddd/application/di/container');
      const { contextAwareDb } = await import('./lib/db/simple-context-proxy');

      // Initialize container with DuckDB - this will block until ready
      await DIContainer.getInstance().initialize(contextAwareDb);

      console.log('[Instrumentation] ✅ DI Container initialized successfully');
      console.log('[Instrumentation] ✅ Server ready to handle requests');
    } catch (error) {
      console.error('[Instrumentation] ❌ FATAL: Failed to initialize DI Container');
      console.error('[Instrumentation] ❌ Error details:', error);
      console.error('[Instrumentation] ❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');

      // AIDEV-NOTE: DuckDB is a hard requirement - crash the server if initialization fails
      // This is better than starting in a broken state where all requests fail
      console.error('[Instrumentation] ❌ Terminating server due to initialization failure');
      process.exit(1);
    }
  }
}
