// AIDEV-NOTE: Command for reindexing RAG data
// Supports both full and partial reindexing

import { RagIndexId, OrganizationId, type DomainType } from '@/ddd/domain/rag/value-objects';

export interface ReindexCommand {
  indexId?: string;
  organizationId?: number;
  domainType?: DomainType;
  force?: boolean; // Force reindex even if recently indexed
}

export class ReindexCommandValidator {
  static validate(command: ReindexCommand): void {
    // At least one targeting criteria must be provided
    if (!command.indexId && !command.organizationId) {
      throw new Error('Either index ID or organization ID must be specified');
    }

    if (command.indexId) {
      try {
        RagIndexId.fromString(command.indexId);
      } catch (error) {
        throw new Error('Invalid index ID format');
      }
    }

    if (command.organizationId !== undefined) {
      if (!Number.isInteger(command.organizationId) || command.organizationId <= 0) {
        throw new Error('Organization ID must be a positive integer');
      }
    }

    if (command.domainType !== undefined) {
      const validDomainTypes: DomainType[] = [
        'table', 'file', 'agent', 'team', 'organization', 'database'
      ];

      if (!validDomainTypes.includes(command.domainType)) {
        throw new Error(`Invalid domain type: ${command.domainType}`);
      }
    }
  }

  static toDomainParams(command: ReindexCommand) {
    return {
      indexId: command.indexId ? RagIndexId.fromString(command.indexId) : undefined,
      organizationId: command.organizationId ? OrganizationId.fromNumber(command.organizationId) : undefined,
      domainType: command.domainType,
      force: command.force ?? false
    };
  }
}