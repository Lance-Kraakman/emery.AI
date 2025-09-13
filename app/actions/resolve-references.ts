'use server';

/**
 * Server Action for Chat Reference Resolution
 * 
 * Handles @doc, @file, @table, @agent reference resolution on the server side.
 * This prevents client-side imports of server-only modules like DuckDB and fs/promises.
 * 
 * AIDEV-NOTE: Moved from client-side EmeryChat to fix build issues with server-only dependencies.
 */

import { resolveReferences, type ReferenceResolutionResult } from '@/lib/chat/reference-resolver';
import { hasReferences } from '@/lib/chat/reference-patterns';

export interface ResolveReferencesParams {
  message: string;
  emeryData: any; // TODO: Type this properly based on EmeryStore structure
}

export async function resolveReferencesAction(params: ResolveReferencesParams): Promise<ReferenceResolutionResult> {
  const { message, emeryData } = params;
  
  if (!hasReferences(message)) {
    // Return simple result for messages without references
    return {
      originalMessage: message,
      parsedReferences: [],
      resolvedReferences: [],
      enrichedContext: message,
      hasErrors: false
    };
  }
  
  return await resolveReferences(message, emeryData);
}

