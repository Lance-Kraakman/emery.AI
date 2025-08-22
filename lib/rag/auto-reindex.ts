import { indexingApplicationService, indexRepository } from '@/ddd/application/rag/di-container'
import { OrganizationId } from '@/ddd/domain/rag/value-objects'
import type { DomainType } from '@/ddd/domain/rag/value-objects'

// AIDEV-NOTE: Auto-reindexing service for maintaining RAG indexes when data changes
// AIDEV-NOTE: Migrated to use Domain-Driven Design application services
export class AutoReindexService {
  
  /**
   * Reindex all RAG indexes for a specific organization when data changes
   * Called when tables, fields, agents, or other indexed content is modified
   */
  async reindexOrganization(organizationId: number): Promise<void> {
    try {
      console.log(`[AUTO-REINDEX] Starting reindexing for organization ${organizationId}`)
      
      const orgId = new OrganizationId(organizationId);
      
      // Get all active RAG indexes for this organization
      const indexes = await indexRepository.findByOrganization(orgId);
      
      if (indexes.length === 0) {
        console.log(`[AUTO-REINDEX] No RAG indexes found for organization ${organizationId}`)
        return
      }
      
      // Reindex each active index in parallel for better performance
      const reindexPromises = indexes
        .filter(index => index.status === 'active')
        .map(async (index) => {
          try {
            console.log(`[AUTO-REINDEX] Reindexing ${index.name} (${index.id.value.substring(0, 8)})`)
            await indexingApplicationService.rebuildIndex({ indexId: index.id.value });
            console.log(`[AUTO-REINDEX] Completed reindexing ${index.name}`)
          } catch (error) {
            console.error(`[AUTO-REINDEX] Failed to reindex ${index.name}:`, error)
            // Mark index as error status using domain entity
            index.failIndexing();
            await indexRepository.save(index);
          }
        })
      
      await Promise.allSettled(reindexPromises)
      console.log(`[AUTO-REINDEX] Completed organization ${organizationId} reindexing`)
      
    } catch (error) {
      console.error(`[AUTO-REINDEX] Critical error during organization ${organizationId} reindexing:`, error)
    }
  }
  
  /**
   * Reindex specific domain types for an organization
   * More targeted than full organization reindexing
   */
  async reindexDomainType(organizationId: number, domainType: DomainType): Promise<void> {
    try {
      console.log(`[AUTO-REINDEX] Reindexing ${domainType} for organization ${organizationId}`)
      
      const orgId = new OrganizationId(organizationId);
      
      const indexes = await indexRepository.findByOrganization(orgId);
      const relevantIndexes = indexes.filter(index => 
        index.domainTypes.includes(domainType) && index.status === 'active'
      )
      
      if (relevantIndexes.length === 0) {
        console.log(`[AUTO-REINDEX] No RAG indexes found for ${domainType} in organization ${organizationId}`)
        return
      }
      
      // Reindex only the relevant indexes
      for (const index of relevantIndexes) {
        try {
          await indexingService.rebuildIndex({ indexId: index.id.value });
          console.log(`[AUTO-REINDEX] Reindexed ${index.name} for ${domainType}`)
        } catch (error) {
          console.error(`[AUTO-REINDEX] Failed to reindex ${index.name} for ${domainType}:`, error)
          // Mark index as error status using domain entity
          index.failIndexing();
          await indexRepository.save(index);
        }
      }
      
    } catch (error) {
      console.error(`[AUTO-REINDEX] Error reindexing ${domainType} for organization ${organizationId}:`, error)
    }
  }
  
  /**
   * Debounced reindexing to avoid excessive reindexing on rapid changes
   * Uses a simple timeout-based debounce strategy
   */
  private debounceTimers = new Map<string, NodeJS.Timeout>()
  
  async debouncedReindex(organizationId: number, domainType?: DomainType, delayMs: number = 5000): Promise<void> {
    const key = domainType ? `${organizationId}-${domainType}` : `${organizationId}`
    
    // Clear existing timeout
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key)!)
    }
    
    // Set new timeout
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key)
      
      if (domainType) {
        const validDomainTypes: DomainType[] = ['table', 'file', 'agent', 'team', 'organization', 'database'];
        if (validDomainTypes.includes(domainType)) {
          await this.reindexDomainType(organizationId, domainType)
        } else {
          console.error(`[AUTO-REINDEX] Invalid domain type: ${domainType}`)
        }
      } else {
        await this.reindexOrganization(organizationId)
      }
    }, delayMs)
    
    this.debounceTimers.set(key, timer)
    console.log(`[AUTO-REINDEX] Scheduled debounced reindexing for ${key} in ${delayMs}ms`)
  }
}

export const autoReindexService = new AutoReindexService()
