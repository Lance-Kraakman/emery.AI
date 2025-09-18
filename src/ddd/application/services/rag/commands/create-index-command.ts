// AIDEV-NOTE: Command for creating RAG indexes
// Updated to use value objects instead of primitives for type safety

import { OrganizationId, type DomainType } from '@/src/ddd/domain/rag/value-objects';
import { AgentId } from '@/src/ddd/domain/shared/value-objects';

export interface CreateIndexCommand {
  name: string;
  description?: string;
  organizationId: OrganizationId;
  agentId?: AgentId;
  domainTypes: DomainType[];
  domainFilters?: Record<string, any>;
  embeddingModel?: string;
  embeddingDimensions?: number;
}

export class CreateIndexCommandValidator {
  static validate(command: CreateIndexCommand): void {
    if (!command.name || command.name.trim().length === 0) {
      throw new Error('Index name is required');
    }

    if (command.name.length > 100) {
      throw new Error('Index name cannot exceed 100 characters');
    }

    if (!command.organizationId) {
      throw new Error('Valid organization ID is required');
    }

    if (!command.domainTypes || command.domainTypes.length === 0) {
      throw new Error('At least one domain type must be specified');
    }

    const validDomainTypes: DomainType[] = [
      'tables', 'files', 'agents', 'teams', 'organizations', 'databases'
    ];

    for (const domainType of command.domainTypes) {
      if (!validDomainTypes.includes(domainType)) {
        throw new Error(`Invalid domain type: ${domainType}`);
      }
    }

    // Value objects already validated on construction, no need for additional validation

    if (command.embeddingDimensions !== undefined && (!Number.isInteger(command.embeddingDimensions) || command.embeddingDimensions <= 0)) {
      throw new Error('Embedding dimensions must be a positive integer');
    }
  }

  static toDomainParams(command: CreateIndexCommand) {
    return {
      name: command.name.trim(),
      description: command.description?.trim(),
      organizationId: command.organizationId, // Already a value object
      agentId: command.agentId?.value, // Extract primitive for domain params
      domainTypes: [...command.domainTypes],
      domainFilters: command.domainFilters ? { ...command.domainFilters } : undefined,
      embeddingModel: command.embeddingModel,
      embeddingDimensions: command.embeddingDimensions
    };
  }
}