/**
 * Simplified Context Proxy - Approach #2
 * 
 * AIDEV-NOTE: JavaScript Proxy around regular Drizzle client that intercepts
 * essential methods to automatically apply RLS context when context is set.
 * 
 * This avoids the complex Drizzle proxy array deserialization issues while
 * still providing automatic DB-level context application.
 * 
 * Unlike the old 315-line complex proxy, this focuses on just the essential
 * methods that repositories actually use.
 */

import { contextManager } from './context-manager';
import { withRLSContext } from './rls-context';
import type { DbClient } from './client';
import { db } from './client';

/**
 * Simple approach: Store query info and rebuild on transaction client
 * This captures the query-building chain and replays it on the transaction
 */
function createQueryBuilderProxy(queryBuilder: any, originalDb: DbClient, context: { organizationId: any; userId?: any }, initialSteps: Array<{ method: string; args: any[] }> = []): any {
  // Store the query building steps - start with any initial steps
  const querySteps: Array<{ method: string; args: any[] }> = [...initialSteps];
  
  return new Proxy(queryBuilder, {
    get(target, prop, receiver) {
      const originalMethod = Reflect.get(target, prop, receiver);
      
      // Handle Promise methods - this is where execution happens
      if (prop === 'then' && typeof originalMethod === 'function') {
        return function(resolve?: any, reject?: any) {
          // Execute with RLS context
          return withRLSContext(
            originalDb,
            context.organizationId,
            async (tx) => {
              // CRITICAL FIX: Execute the query using the transaction client with RLS context
              // Rebuild the query chain on the transaction client using stored querySteps
              try {
                if (querySteps.length === 0) {
                  console.warn('⚠️ RLS Context Warning: No query steps recorded, executing original query');
                  return await target;
                }
                
                // Rebuild the query chain on the transaction client
                let query = tx;
                for (const step of querySteps) {
                  query = (query as any)[step.method](...step.args);
                }
                
                return await query;
              } catch (error) {
                // Fallback: if rebuilding fails, execute original query with warning
                console.warn('⚠️ RLS Context Error: Query rebuilding failed, falling back to original query:', error);
                console.warn('Query steps were:', querySteps);
                return await target;
              }
            },
            context.userId
          ).then(resolve, reject);
        };
      }
      
      if (prop === 'catch' && typeof originalMethod === 'function') {
        return function(reject?: any) {
          return withRLSContext(
            originalDb,
            context.organizationId,
            async (tx) => {
              // CRITICAL FIX: Same query rebuilding logic as 'then' method
              try {
                if (querySteps.length === 0) {
                  console.warn('⚠️ RLS Context Warning: No query steps recorded in catch, executing original query');
                  return await target;
                }
                
                // Rebuild the query chain on the transaction client
                let query = tx;
                for (const step of querySteps) {
                  query = (query as any)[step.method](...step.args);
                }
                
                return await query;
              } catch (error) {
                console.warn('⚠️ RLS Context Error: Query rebuilding failed in catch, falling back to original query:', error);
                console.warn('Query steps were:', querySteps);
                return await target;
              }
            },
            context.userId
          ).catch(reject);
        };
      }
      
      // For chaining methods, return a new proxy that tracks the chain
      if (typeof originalMethod === 'function') {
        return function(...args: any[]) {
          querySteps.push({ method: prop as string, args });
          // console.log(`🔍 RLS Proxy: Recording query step: ${prop as string}`, args.length > 0 ? `with ${args.length} args` : '');
          const result = originalMethod.apply(target, args);
          
          // Return proxy for continued chaining, but avoid infinite recursion
          if (result && typeof result === 'object' && result !== target && !result._isQueryBuilderProxy) {
            // Mark this object as already being a proxy to prevent recursive wrapping
            const proxiedResult = createQueryBuilderProxy(result, originalDb, context, querySteps);
            Object.defineProperty(proxiedResult, '_isQueryBuilderProxy', { 
              value: true, 
              writable: false, 
              enumerable: false 
            });
            return proxiedResult;
          }
          
          return result;
        };
      }
      
      return originalMethod;
    }
  });
}

/**
 * Create a simplified context proxy that intercepts key database methods
 *
 * This proxy focuses on the methods that repositories actually use:
 * - transaction() - Most repository operations go through transactions
 * - select(), insert(), update(), delete() - Direct query builder operations
 * - query - Relational queries (db.query.users.findMany)
 */
function createSimpleContextProxy(baseDb: DbClient): DbClient {
  // Add recursion guard
  let isInRLSCall = false;

  return new Proxy(baseDb, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);
      
      // Debug: Log all property access to key methods (temporarily disabled)
      // if (typeof prop === 'string' && ['select', 'insert', 'update', 'delete', 'transaction'].includes(prop)) {
      //   console.log(`🔍 PROXY DEBUG: Accessing property "${prop}"`);
      // }
      
      // Intercept transaction method - this covers most repository operations
      if (prop === 'transaction') {
        return function(callback: any, config?: any) {
          const context = contextManager.getContext();

          if (context && !isInRLSCall) {
            isInRLSCall = true;
            try {
              // Wrap transaction with RLS context
              return withRLSContext(
                target, // Use original target to avoid proxy recursion
                context.organizationId,
                callback, // Pass the transaction callback through
                context.userId
              );
            } finally {
              isInRLSCall = false;
            }
          } else {
            // No context or already in RLS call - call original transaction
            return originalValue.call(target, callback, config);
          }
        };
      }
      
      // Intercept query builder methods (select, insert, update, delete)
      if (prop === 'select' || prop === 'insert' || prop === 'update' || prop === 'delete') {
        return function(...args: any[]) {
          const context = contextManager.getContext();
          // console.log(`🔍 RLS Proxy: Intercepted ${prop as string} method, context:`, context ? `org=${context.organizationId.value}` : 'NONE', 'stack:', new Error().stack?.split('\n')[2]);
          
          if (context) {
            // Create the query builder first, then proxy it with the initial step
            const queryBuilder = originalValue.apply(target, args);
            const initialStep = { method: prop as string, args };
            return createQueryBuilderProxy(queryBuilder, target, context, [initialStep]);
          } else {
            // No context - call original method
            return originalValue.apply(target, args);
          }
        };
      }
      
      // Intercept query property for relational queries (db.query.users.findMany)
      if (prop === 'query') {
        const context = contextManager.getContext();
        
        if (context) {
          // Create a proxy for query operations that applies RLS context
          return new Proxy(originalValue, {
            get(queryTarget, tableProp) {
              const tableQuery = Reflect.get(queryTarget, tableProp);
              
              if (tableQuery && typeof tableQuery === 'object') {
                // This is a table query object (e.g., db.query.users)
                return new Proxy(tableQuery, {
                  get(tableTarget, methodProp) {
                    const tableMethod = Reflect.get(tableTarget, methodProp);
                    
                    if (typeof tableMethod === 'function') {
                      // This is a query method (findMany, findFirst, etc.)
                      return function(...args: any[]) {
                        // Wrap the query method with RLS context
                        return withRLSContext(
                          target,
                          context.organizationId,
                          async (tx) => {
                            // Call the method on the transaction's query interface
                            return (tx.query as any)[tableProp][methodProp](...args);
                          },
                          context.userId
                        );
                      };
                    }
                    
                    return tableMethod;
                  }
                });
              }
              
              return tableQuery;
            }
          });
        } else {
          // No context - return original query interface
          return originalValue;
        }
      }
      
      // For all other properties/methods, return as-is
      return originalValue;
    }
  }) as DbClient;
}

/**
 * Context-aware database client using simplified JavaScript proxy
 * This preserves all Drizzle functionality while automatically applying RLS when context is set
 */
console.log('🔍 PROXY: Creating context-aware database client (with recursion fix)');
export const contextAwareDb = createSimpleContextProxy(db);
console.log('🔍 PROXY: Context-aware database client created (recursion fixed)');

// Export the type - same as regular DbClient since proxy preserves all functionality
export type ContextAwareDbClient = DbClient;