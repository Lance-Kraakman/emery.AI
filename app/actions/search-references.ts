'use server';

/**
 * Server Action for Reference Search
 * 
 * Simple bridge between TanStack Query and ReferenceApplicationService
 * Following pattern: TanStack Query → Server Action → Application Service
 * 
 * AIDEV-NOTE: This replaces the over-engineered TanStack Store approach
 * with clean server-side data fetching that leverages existing DDD services.
 */

import { getReferenceApplicationService } from '@/ddd/application/di/container';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { SimpleReference, SearchReferencesResult } from '@/ddd/application/services/chat/reference-application-service';

export interface SearchReferencesParams {
  query: string;
  categories?: ('doc' | 'file' | 'agent' | 'table' | 'database')[];
  limit?: number;
  offset?: number;
  organizationId: number;
}

/**
 * Search references for chat mentions
 * Used by TanStack Query for efficient client-side caching and state management
 */
export async function searchReferences(params: SearchReferencesParams): Promise<SearchReferencesResult> {
  try {
    console.log('[SEARCH-REFERENCES-ACTION] 🔍 Starting reference search:', params);
    
    const referenceService = getReferenceApplicationService();
    const organizationId = OrganizationId.fromNumber(params.organizationId);
    
    const result = await referenceService.searchReferences({
      query: params.query,
      categories: params.categories,
      limit: params.limit || 20,
      offset: params.offset || 0,
      organizationId
    });

    console.log(`[SEARCH-REFERENCES-ACTION] ✅ Found ${result.references.length} references for "${params.query}"`);
    
    return result;
  } catch (error) {
    console.error('[SEARCH-REFERENCES-ACTION] ❌ Search failed:', error);
    
    // Return empty result instead of throwing to prevent TanStack Query errors
    return {
      references: [],
      hasMore: false,
      totalCount: 0
    };
  }
}

/**
 * Get all available reference categories
 * Useful for UI category filters
 */
export async function getReferenceCategories(): Promise<Array<{
  id: 'doc' | 'file' | 'agent' | 'table' | 'database';
  name: string;
  description: string;
}>> {
  return [
    {
      id: 'doc',
      name: 'Documents',
      description: 'Document records from tables'
    },
    {
      id: 'file', 
      name: 'Files',
      description: 'File attachments and uploads'
    },
    {
      id: 'agent',
      name: 'Agents',
      description: 'AI agents and assistants'
    },
    {
      id: 'table',
      name: 'Tables',
      description: 'Data tables and schemas'
    },
    {
      id: 'database',
      name: 'Databases',
      description: 'Database collections'
    }
  ];
}