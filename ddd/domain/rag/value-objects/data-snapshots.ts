// AIDEV-NOTE: RAG-specific value objects for data transfer
// These represent read-only snapshots of domain entities for RAG indexing purposes

import type { Organization } from '@/ddd/domain/organizations/entities/organization';
import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import type { Field } from '@/ddd/domain/fields/entities/field';

/**
 * Read-only snapshot of organization data for RAG indexing
 */
export class OrganizationDataSnapshot {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly mission?: string | null,
    public readonly sharedToolsCount?: number,
    public readonly sharedServersCount?: number,
    public readonly createdAt?: Date | null
  ) {}

  static fromEntity(organization: Organization): OrganizationDataSnapshot {
    return new OrganizationDataSnapshot(
      organization.id,
      organization.name,
      organization.mission,
      Array.isArray(organization.sharedTools) ? organization.sharedTools.length : 0,
      Array.isArray(organization.sharedServers) ? organization.sharedServers.length : 0,
      organization.createdAt
    );
  }
}

/**
 * Read-only snapshot of field data for RAG indexing
 */
export class FieldDataSnapshot {
  constructor(
    public readonly id: number,
    public readonly tableId: number,
    public readonly name: string,
    public readonly slug: string,
    public readonly type: string,
    public readonly orderIndex: number,
    public readonly relatedTableId?: number | null,
    public readonly required: boolean,
    public readonly createdAt: Date
  ) {}

  static fromEntity(field: Field): FieldDataSnapshot {
    return new FieldDataSnapshot(
      field.id,
      field.tableId,
      field.name,
      field.slug,
      field.type,
      field.orderIndex ?? 0,
      field.relatedTableId,
      field.required ?? false,
      field.createdAt ?? new Date()
    );
  }
}

/**
 * Read-only snapshot of table data for RAG indexing
 */
export class TableDataSnapshot {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly dbName: string,
    public readonly databaseId: number,
    public readonly organizationId: number,
    public readonly databaseName?: string | null,
    public readonly databaseSlug?: string | null,
    public readonly fields: FieldDataSnapshot[] = []
  ) {}

  static fromEntity(table: DynamicTable, fields: Field[] = []): TableDataSnapshot {
    return new TableDataSnapshot(
      table.id,
      table.name,
      table.dbName,
      table.databaseId,
      table.organizationId,
      undefined, // Will be populated by service
      undefined, // Will be populated by service  
      fields.map(field => FieldDataSnapshot.fromEntity(field))
    );
  }
}

/**
 * Read-only snapshot of database data for RAG indexing
 */
export class DatabaseDataSnapshot {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly slug: string,
    public readonly metadata?: any,
    public readonly organizationId: number
  ) {}

  static fromEntity(database: any): DatabaseDataSnapshot {
    return new DatabaseDataSnapshot(
      database.id,
      database.name,
      database.slug,
      database.metadata,
      database.organizationId
    );
  }
}

/**
 * Read-only snapshot of agent data for RAG indexing
 */
export class AgentDataSnapshot {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly role?: string | null,
    public readonly description?: string | null,
    public readonly persona?: string | null,
    public readonly tools?: any,
    public readonly servers?: any,
    public readonly capabilities?: any,
    public readonly status?: string | null,
    public readonly createdAt?: Date | null
  ) {}

  static fromEntity(agent: any): AgentDataSnapshot {
    return new AgentDataSnapshot(
      agent.id,
      agent.name,
      agent.role,
      agent.description,
      agent.persona,
      agent.tools,
      agent.servers,
      agent.capabilities,
      agent.status,
      agent.createdAt
    );
  }
}

/**
 * Read-only snapshot of team data for RAG indexing
 */
export class TeamDataSnapshot {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly purpose?: string | null,
    public readonly description?: string | null,
    public readonly responsibilities?: string[] | null,
    public readonly goals?: string[] | null,
    public readonly agentIds?: string[] | null,
    public readonly createdAt?: Date | null
  ) {}

  static fromEntity(team: any): TeamDataSnapshot {
    return new TeamDataSnapshot(
      team.id,
      team.name,
      team.purpose,
      team.description,
      team.responsibilities,
      team.goals,
      team.agentIds,
      team.createdAt
    );
  }
}

/**
 * Read-only snapshot of file data for RAG indexing
 */
export class FileDataSnapshot {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly size: number,
    public readonly mimeType: string,
    public readonly s3Key: string,
    public readonly uploadedAt: Date,
    public readonly tableId: number,
    public readonly tableName: string,
    public readonly databaseName: string,
    public readonly fieldId: number,
    public readonly fieldName: string
  ) {}

  static fromEntity(file: any): FileDataSnapshot {
    return new FileDataSnapshot(
      file.id,
      file.name,
      file.size,
      file.mimeType,
      file.s3Key,
      file.uploadedAt,
      file.tableId || 0,
      file.tableName || 'unknown',
      file.databaseName || 'unknown',
      file.fieldId || 0,
      file.fieldName || 'unknown'
    );
  }
}