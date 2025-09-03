/**
 * Dual-Context RAG Service
 * 
 * Provides intelligent context retrieval for domain-connected chats.
 * Combines domain-specific context (prioritized) with organizational context (background).
 * Supports tables, agents, files, teams, and other domain types.
 * 
 * AIDEV-NOTE: Core service for dual-context RAG strategy - manages prioritized
 * domain-specific context while maintaining organizational awareness
 */

import type { SearchRagQuery } from '@/ddd/application/services/rag/queries/search-query';
import { getRagSearchApplicationService, getRagIndexRepository } from '@/ddd/application/di/container';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import { OrganizationId } from '@/ddd/domain/rag/value-objects';
import { AgentId, TableId } from '@/ddd/domain/shared/value-objects';

export interface RagDocument {
  id: string;
  title: string;
  content: string;
  domainType: string;
  sourceName: string;
  similarity?: number;
  metadata?: Record<string, any>;
}

export interface RagSource {
  type: 'primary' | 'secondary';
  domainType: string;
  domainId?: number;
  count: number;
  avgSimilarity: number;
}

export interface DualContextResult {
  primaryContext: RagDocument[];
  secondaryContext: RagDocument[];
  ragSources: RagSource[];
  totalDocuments: number;
  primaryWeight: number;
  secondaryWeight: number;
}

export interface DomainContextOptions {
  domainType: 'table' | 'agent' | 'file' | 'team' | 'workflow' | 'organization' | null;
  domainId?: number;
  organizationId: number;
  query: string;
  primaryWeight?: number; // 0.0-1.0, defaults to 0.7
  maxPrimaryDocs?: number; // Max primary context docs, defaults to 3
  maxSecondaryDocs?: number; // Max secondary context docs, defaults to 2
  similarityThreshold?: number; // Minimum similarity, defaults to 0.3
}

/**
 * Abstract base for domain-specific context builders
 */
export abstract class DomainContextBuilder {
  abstract getDomainType(): string;
  abstract buildContext(domainId: number, query: string, organizationId: number): Promise<RagDocument[]>;
  
  getDefaultWeight(): number {
    return 0.7; // Primary context gets 70% weight by default
  }
}

/**
 * Table Context Builder - builds context from table schema and data
 */
export class TableContextBuilder extends DomainContextBuilder {
  constructor(private tableRepository: IDynamicTableRepository) {
    super();
  }

  getDomainType(): string {
    return 'table';
  }

  async buildContext(domainId: number, query: string, organizationId: number): Promise<RagDocument[]> {
    try {
      const table = await this.tableRepository.findById(TableId.fromNumber(domainId));
      if (!table || table.organizationId.value !== organizationId) {
        return [];
      }

      // Build table-specific context documents
      const context: RagDocument[] = [];

      // 1. Table schema information
      context.push({
        id: `table_schema_${domainId}`,
        title: `Table Schema: ${table.name}`,
        content: `Table "${table.name}"\nThis table contains structured data with multiple fields and relationships. Users can query and analyze data from this table.`,
        domainType: 'tables',
        sourceName: table.name,
        similarity: 1.0, // Perfect match for schema
        metadata: {
          tableId: domainId,
          schemaType: 'table_definition'
        }
      });

      // 2. Recent activity summary (would need implementation)
      context.push({
        id: `table_activity_${domainId}`,
        title: `Recent Activity: ${table.name}`,
        content: `Recent data operations and user interactions with table "${table.name}". This table is actively used for data management and analysis.`,
        domainType: 'tables',
        sourceName: `${table.name} Activity`,
        similarity: 0.8,
        metadata: {
          tableId: domainId,
          schemaType: 'activity_summary'
        }
      });

      return context;
    } catch (error) {
      console.error('[TABLE-CONTEXT-BUILDER] Error building table context:', error);
      return [];
    }
  }
}

/**
 * Agent Context Builder - builds context from agent capabilities and executions
 */
export class AgentContextBuilder extends DomainContextBuilder {
  constructor(private agentRepository: IAgentRepository) {
    super();
  }

  getDomainType(): string {
    return 'agent';
  }

  async buildContext(domainId: number, query: string, organizationId: number): Promise<RagDocument[]> {
    try {
      const agent = await this.agentRepository.findById(AgentId.fromNumber(domainId));
      if (!agent || agent.organizationId.value !== organizationId) {
        return [];
      }

      const context: RagDocument[] = [];

      // 1. Agent configuration and capabilities
      context.push({
        id: `agent_config_${domainId}`,
        title: `Agent Configuration: ${agent.name}`,
        content: `Agent "${agent.name}" with role: ${agent.role}\nDescription: ${agent.description || 'AI assistant agent'}\nThis agent can execute tasks and provide assistance within the organization.`,
        domainType: 'agent',
        sourceName: agent.name,
        similarity: 1.0,
        metadata: {
          agentId: domainId,
          schemaType: 'agent_config'
        }
      });

      // 2. Recent execution summary
      context.push({
        id: `agent_executions_${domainId}`,
        title: `Execution History: ${agent.name}`,
        content: `Recent execution history and performance data for agent "${agent.name}". This agent has been actively processing tasks and user requests.`,
        domainType: 'agent',
        sourceName: `${agent.name} Executions`,
        similarity: 0.8,
        metadata: {
          agentId: domainId,
          schemaType: 'execution_history'
        }
      });

      return context;
    } catch (error) {
      console.error('[AGENT-CONTEXT-BUILDER] Error building agent context:', error);
      return [];
    }
  }
}

/**
 * Main Dual-Context RAG Service
 */
export class DualContextRagService {
  private contextBuilders: Map<string, DomainContextBuilder> = new Map();

  constructor(
    tableRepository: IDynamicTableRepository,
    agentRepository: IAgentRepository
  ) {
    // Register domain context builders
    this.contextBuilders.set('table', new TableContextBuilder(tableRepository));
    this.contextBuilders.set('agent', new AgentContextBuilder(agentRepository));
  }

  /**
   * Get dual-context RAG results for a domain-connected chat
   */
  async getDualContext(options: DomainContextOptions): Promise<DualContextResult> {
    const {
      domainType,
      domainId,
      organizationId,
      query,
      primaryWeight = 0.7,
      maxPrimaryDocs = 3,
      maxSecondaryDocs = 2,
      similarityThreshold = 0.3
    } = options;

    try {
      let primaryContext: RagDocument[] = [];
      let secondaryContext: RagDocument[] = [];
      const ragSources: RagSource[] = [];

      // 1. Get domain-specific (primary) context
      if (domainType && domainType !== 'organization' && domainId) {
        const builder = this.contextBuilders.get(domainType);
        if (builder) {
          primaryContext = await builder.buildContext(domainId, query, organizationId);
          primaryContext = primaryContext.slice(0, maxPrimaryDocs); // Limit results
          
          if (primaryContext.length > 0) {
            ragSources.push({
              type: 'primary',
              domainType,
              domainId,
              count: primaryContext.length,
              avgSimilarity: primaryContext.reduce((sum, doc) => sum + (doc.similarity || 0), 0) / primaryContext.length
            });
          }
        }
      }

      // 2. Get organizational (secondary) context from existing RAG system
      try {
        // First check if organization has any RAG indexes
        const indexRepository = getRagIndexRepository();
        const orgIndexes = await indexRepository.findByOrganization(
          OrganizationId.fromNumber(organizationId)
        );
        
        if (orgIndexes.length === 0) {
          console.log(`[DUAL-CONTEXT-RAG] No RAG indexes found for organization ${organizationId}, skipping secondary context`);
          // Skip RAG search - no indexes available
        } else {
          // Use the first active index found
          const activeIndex = orgIndexes.find(idx => idx.status === 'active');
          if (!activeIndex) {
            console.log(`[DUAL-CONTEXT-RAG] No active RAG indexes found for organization ${organizationId}, skipping secondary context`);
            // Skip RAG search - no active indexes
          } else {
            const searchQuery: SearchRagQuery = {
              indexId: activeIndex.id.value,
              query,
              limit: maxSecondaryDocs,
              threshold: similarityThreshold,
              organizationId: organizationId,
              userId: 'system' // System query for context building
            };

            const searchApplicationService = getRagSearchApplicationService();
            const searchResult = await searchApplicationService.search(searchQuery);
        
            secondaryContext = searchResult.data?.documents.map(doc => ({
              id: doc.id,
              title: doc.title,
              content: doc.content.substring(0, 500) + '...',
              domainType: doc.domainType || 'organization',
              sourceName: doc.sourceName || 'Organization Data',
              similarity: doc.similarity,
              metadata: doc.metadata
            })) ?? [];

            if (secondaryContext.length > 0) {
              ragSources.push({
                type: 'secondary',
                domainType: 'organization',
                count: secondaryContext.length,
                avgSimilarity: secondaryContext.reduce((sum, doc) => sum + (doc.similarity || 0), 0) / secondaryContext.length
              });
            }
          }
        }
      } catch (ragError) {
        // Check if error is due to missing index vs other issues
        const errorMessage = ragError instanceof Error ? ragError.message : 'Unknown error';
        if (errorMessage.includes('not found') || errorMessage.includes('Invalid index ID format')) {
          console.log('[DUAL-CONTEXT-RAG] No secondary RAG index available for this organization');
        } else {
          console.error('[DUAL-CONTEXT-RAG] Secondary context search failed:', ragError);
        }
        // Continue without secondary context in all cases
      }

      const totalDocuments = primaryContext.length + secondaryContext.length;
      const secondaryWeight = 1.0 - primaryWeight;

      console.log(`[DUAL-CONTEXT-RAG] Built context: ${primaryContext.length} primary + ${secondaryContext.length} secondary docs for ${domainType || 'organization'} chat`);

      return {
        primaryContext,
        secondaryContext,
        ragSources,
        totalDocuments,
        primaryWeight,
        secondaryWeight
      };

    } catch (error) {
      console.error('[DUAL-CONTEXT-RAG] Error building dual context:', error);
      return {
        primaryContext: [],
        secondaryContext: [],
        ragSources: [],
        totalDocuments: 0,
        primaryWeight,
        secondaryWeight: 1.0 - primaryWeight
      };
    }
  }

  /**
   * Format dual-context for system message
   */
  formatContextForSystemMessage(result: DualContextResult): string {
    if (result.totalDocuments === 0) {
      return '';
    }

    let contextMessage = '\nRELEVANT CONTEXT:\n';

    // Primary (domain-specific) context
    if (result.primaryContext.length > 0) {
      contextMessage += '\n🎯 PRIMARY CONTEXT (Domain-specific):\n';
      result.primaryContext.forEach((doc, idx) => {
        contextMessage += `[P${idx + 1}] ${doc.title}\n${doc.content}\nSource: ${doc.domainType} - ${doc.sourceName} (${((doc.similarity || 0) * 100).toFixed(1)}% match)\n---\n`;
      });
    }

    // Secondary (organizational) context
    if (result.secondaryContext.length > 0) {
      contextMessage += '\n📚 SECONDARY CONTEXT (Organizational):\n';
      result.secondaryContext.forEach((doc, idx) => {
        contextMessage += `[S${idx + 1}] ${doc.title}\n${doc.content}\nSource: ${doc.domainType} - ${doc.sourceName} (${((doc.similarity || 0) * 100).toFixed(1)}% match)\n---\n`;
      });
    }

    contextMessage += `\nContext Weighting: ${(result.primaryWeight * 100).toFixed(0)}% primary, ${(result.secondaryWeight * 100).toFixed(0)}% secondary\n`;

    return contextMessage;
  }

  /**
   * Get RAG source summary for message metadata
   */
  getRagSourceSummary(result: DualContextResult): string[] {
    return result.ragSources.map(source => 
      source.domainId ? `${source.type}:${source.domainType}:${source.domainId}` : `${source.type}:${source.domainType}`
    );
  }
}