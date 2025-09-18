// AIDEV-NOTE: Command for reindexing RAG data
// Updated to use value objects instead of primitives for type safety

import { RagIndexId, OrganizationId, type DomainType } from '@/src/ddd/domain/rag/value-objects';

export interface ReindexCommand {
  indexId?: RagIndexId;
  organizationId?: OrganizationId;
  domainType?: DomainType;
  force?: boolean; // Force reindex even if recently indexed
}

export class ReindexCommandValidator {
  static validate(command: ReindexCommand): void {
    // At least one targeting criteria must be provided
    if (!command.indexId && !command.organizationId) {
      throw new Error('Either index ID or organization ID must be specified');
    }

    // Value objects already validated on construction, no need for additional validation

    if (command.domainType !== undefined) {
      const validDomainTypes: DomainType[] = [
        'tables', 'files', 'agents', 'teams', 'organizations', 'databases'
      ];

      if (!validDomainTypes.includes(command.domainType)) {
        throw new Error(`Invalid domain type: ${command.domainType}`);
      }
    }
  }

  static toDomainParams(command: ReindexCommand) {
    return {
      indexId: command.indexId, // Already a value object
      organizationId: command.organizationId, // Already a value object
      domainType: command.domainType,
      force: command.force ?? false
    };
  }
}