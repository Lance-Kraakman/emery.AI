/**
 * RAG Dispatcher - Handles automatic RAG re-indexing from database changes
 * Uses PostgreSQL LISTEN/NOTIFY for real-time indexing
 * Mirrors ManualDispatcher architecture for consistency
 * 
 * AIDEV-NOTE: Built into the scheduler service (not standalone) to follow
 * existing patterns and keep deployment simple. All dispatchers are built-in.
 */

import { createNotificationClient, rawClient } from '@/lib/db/client';
import { autoReindexService } from '@/lib/rag/auto-reindex';
import type { DomainType } from '@/lib/domain/rag/value-objects';
import type postgres from 'postgres';

export interface RagReindexRequest {
  organizationId: number;
  domainType?: DomainType;
  changeType?: 'INSERT' | 'UPDATE' | 'DELETE';
  sourceId?: string;
  tableName?: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

export class RagDispatcher {
  private isListening = false;
  private notificationListener: postgres.Sql | null = null;

  /**
   * Map legacy domain types to new DDD domain types
   * AIDEV-NOTE: Handles backward compatibility during transition
   */
  private mapLegacyDomainType(legacyType?: string): DomainType | undefined {
    if (!legacyType) return undefined;
    
    const mapping: Record<string, DomainType> = {
      'tables': 'table',
      'files': 'file', 
      'agents': 'agent',
      'teams': 'team',
      'workflows': 'agent', // Workflows are part of agent domain
      'organizations': 'organization',
      'databases': 'database'
    };
    
    return mapping[legacyType] || legacyType as DomainType;
  }

  /**
   * Start listening for RAG reindex notifications
   */
  async start(): Promise<void> {
    if (this.isListening) {
      console.log('[RAG-DISPATCHER] Already listening');
      return;
    }

    try {
      console.log('[RAG-DISPATCHER] 🎧 Starting RAG re-index listener...');
      
      // Create dedicated notification client using centralized configuration
      this.notificationListener = createNotificationClient();
      
      // Handle notifications using postgres.js listen pattern
      await this.notificationListener.listen('rag_reindex_needed', async (payload: string) => {
        console.log(`[RAG-DISPATCHER] 🔔 RAG re-index notification received`);
        
        try {
          const reindexRequest: RagReindexRequest = JSON.parse(payload);
          await this.handleReindexRequest(reindexRequest);
        } catch (error) {
          console.error('[RAG-DISPATCHER] ❌ Error processing re-index request:', error);
        }
      });
      
      this.isListening = true;
      console.log('[RAG-DISPATCHER] ✅ RAG re-index listener started');
      
    } catch (error) {
      console.error('[RAG-DISPATCHER] ❌ Failed to start RAG re-index listener:', error);
    }
  }

  /**
   * Stop listening for RAG reindex notifications
   */
  async stop(): Promise<void> {
    if (!this.isListening) return;

    try {
      if (this.notificationListener) {
        await this.notificationListener`UNLISTEN rag_reindex_needed`;
        await this.notificationListener.end();
        this.notificationListener = null;
      }
      
      this.isListening = false;
      console.log('[RAG-DISPATCHER] 🛑 RAG re-index listener stopped');
    } catch (error) {
      console.error('[RAG-DISPATCHER] ❌ Error stopping RAG re-index listener:', error);
    }
  }

  /**
   * Handle a RAG reindex request
   */
  private async handleReindexRequest(request: RagReindexRequest): Promise<void> {
    console.log(`[RAG-DISPATCHER] 🚀 Handling re-index for org ${request.organizationId}, domain: ${request.domainType || 'all'}, change: ${request.changeType || 'unknown'}`);
    
    try {
      // Map legacy domain types for backward compatibility
      const mappedDomainType = this.mapLegacyDomainType(request.domainType);
      
      // Use the existing debounced reindex service with 5-second delay
      await autoReindexService.debouncedReindex(
        request.organizationId,
        mappedDomainType
      );
      
      console.log(`[RAG-DISPATCHER] ✅ Scheduled debounced re-index for org ${request.organizationId}`);
    } catch (error) {
      console.error(`[RAG-DISPATCHER] ❌ Error handling re-index request for org ${request.organizationId}:`, error);
    }
  }

  /**
   * Trigger a RAG reindex (called from database triggers or API endpoints)
   */
  static async triggerReindex(request: RagReindexRequest): Promise<void> {
    console.log(`[RAG-DISPATCHER] 📤 Triggering RAG re-index for org ${request.organizationId}, domain: ${request.domainType || 'all'}`);
    
    try {
      // Use shared rawClient for one-off notifications (from centralized client.ts)
      await rawClient`SELECT pg_notify(${'rag_reindex_needed'}, ${JSON.stringify(request)})`;
      
      console.log(`[RAG-DISPATCHER] ✅ RAG re-index notification sent`);
      
    } catch (error) {
      console.error('[RAG-DISPATCHER] ❌ Error triggering RAG re-index:', error);
      throw error;
    }
  }
}

// Global RAG dispatcher instance
export const ragDispatcher = new RagDispatcher();