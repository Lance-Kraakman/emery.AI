// AIDEV-NOTE: Command for creating RAG indexes
// Encapsulates input validation and command data

import { OrganizationId, type DomainType } from '@/lib/domain/rag/value-objects';

export interface CreateIndexCommand {
  name: string;
  description?: string;
  organizationId: number;
  agentId?: number;
  roleId?: number;
  domainTypes: DomainType[];
  domainFilters?: Record<string, any>;
  embeddingModel?: string;
  embeddingDimensions?: number;
  createdBy: string;
}

export class CreateIndexCommandValidator {
  static validate(command: CreateIndexCommand): void {
    if (!command.name || command.name.trim().length === 0) {
      throw new Error('Index name is required');
    }

    if (command.name.length > 100) {
      throw new Error('Index name cannot exceed 100 characters');
    }

    if (!Number.isInteger(command.organizationId) || command.organizationId <= 0) {
      throw new Error('Valid organization ID is required');
    }

    if (!command.domainTypes || command.domainTypes.length === 0) {
      throw new Error('At least one domain type must be specified');
    }

    const validDomainTypes: DomainType[] = [
      'tables', 'files', 'agents', 'teams', 'workflows', 'organizations', 'databases'
    ];

    for (const domainType of command.domainTypes) {
      if (!validDomainTypes.includes(domainType)) {
        throw new Error(`Invalid domain type: ${domainType}`);
      }
    }

    if (!command.createdBy || command.createdBy.trim().length === 0) {
      throw new Error('Creator ID is required');
    }

    if (command.agentId !== undefined && (!Number.isInteger(command.agentId) || command.agentId <= 0)) {
      throw new Error('Agent ID must be a positive integer');
    }

    if (command.roleId !== undefined && (!Number.isInteger(command.roleId) || command.roleId <= 0)) {
      throw new Error('Role ID must be a positive integer');
    }

    if (command.embeddingDimensions !== undefined && (!Number.isInteger(command.embeddingDimensions) || command.embeddingDimensions <= 0)) {
      throw new Error('Embedding dimensions must be a positive integer');
    }
  }

  static toDomainParams(command: CreateIndexCommand) {
    return {
      name: command.name.trim(),
      description: command.description?.trim(),
      organizationId: OrganizationId.fromNumber(command.organizationId),
      agentId: command.agentId,
      roleId: command.roleId,
      domainTypes: [...command.domainTypes],
      domainFilters: command.domainFilters ? { ...command.domainFilters } : undefined,
      embeddingModel: command.embeddingModel,
      embeddingDimensions: command.embeddingDimensions,
      createdBy: command.createdBy.trim()
    };
  }
}