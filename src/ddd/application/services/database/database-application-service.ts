/**
 * Database Application Service
 *
 * Orchestrates database lifecycle operations for logical data organization.
 * Handles database creation, updates, deletion, and business validation.
 * Databases serve as logical namespaces/workspaces for grouping related tables.
 */

import { createDebugLogger } from '@/lib/utils/debug-logger';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';

const logger = createDebugLogger('DatabaseService');
import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import { Database } from '@/ddd/domain/databases/entities/database';
import type { Result } from '@/ddd/domain/shared/result';
import { DatabaseId, OrganizationId, UserId, AgentId } from '@/ddd/domain/shared/value-objects';
import type { CreateDatabaseDTO, UpdateDatabaseDTO, DatabaseFiltersDTO, DatabaseDTO } from '@/app/dtos/database.dto';
import { DatabaseMapper } from '@/app/mappers/database-mapper';

export class DatabaseApplicationService {
  constructor(
    private readonly tableRepository: IDynamicTableRepository,
    private readonly databaseRepository: IDatabaseRepository
  ) {}

  /**
   * Create a new database with business validation
   */
  async createDatabase(dto: CreateDatabaseDTO): Promise<Result<DatabaseDTO>> {
    try {
      // Business validation
      if (!dto.name?.trim()) {
        return {
          success: false,
          error: "Database name is required"
        };
      }

      // Convert DTO to Value Objects
      const organizationId = OrganizationId.fromNumber(dto.organizationId);
      const createdBy = UserId.fromString(dto.ownerId);

      // Create URL-safe slug
      const baseSlug = dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Ensure unique slug within organization
      let slug = baseSlug;
      let counter = 1;
      while (!(await this.databaseRepository.isSlugUnique(organizationId, slug))) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Prepare metadata
      const metadata = dto.description
        ? { description: dto.description, ...dto.metadata }
        : dto.metadata || null;

      // Convert agentId if provided
      const agentId = dto.agentId ? AgentId.fromNumber(dto.agentId) : null;

      // Create database using domain entity
      const database = Database.create({
        name: dto.name.trim(),
        slug,
        metadata,
        organizationId,
        ownerId: createdBy,
        agentId
      });

      // Create database using repository
      const createData = {
        name: database.name,
        slug: database.slug,
        metadata: database.metadata,
        organizationId: database.organizationId.value,
        ownerId: database.ownerId.value,
        agentId: database.agentId?.value || null
      };
      const savedDatabase = await this.databaseRepository.create(createData);

      return {
        success: true,
        data: DatabaseMapper.toDTO(savedDatabase)
      };
    } catch (error) {
      logger.error('Error creating database', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create database"
      };
    }
  }

  /**
   * Update an existing database
   */
  async updateDatabase(dto: UpdateDatabaseDTO): Promise<Result<DatabaseDTO>> {
    try {
      // Convert DTO to Value Objects
      const databaseId = DatabaseId.fromNumber(dto.databaseId);

      // Load existing database
      const existingDatabase = await this.databaseRepository.findById(databaseId as any);
      if (!existingDatabase) {
        return {
          success: false,
          error: `Database with ID ${dto.databaseId} not found`
        };
      }

      // Prepare updated metadata
      let metadata = existingDatabase.metadata;
      if (dto.description !== undefined || dto.metadata !== undefined) {
        metadata = {
          ...metadata,
          ...dto.metadata
        };
        if (dto.description !== undefined) {
          if (dto.description) {
            metadata = { ...metadata, description: dto.description };
          } else {
            // Remove description if explicitly set to empty
            const { description, ...rest } = metadata || {};
            metadata = rest;
          }
        }
      }

      // Create updated database
      const updatedDatabase = Database.fromPersistence({
        id: existingDatabase.id.value,
        name: dto.name !== undefined ? dto.name : existingDatabase.name,
        slug: existingDatabase.slug, // Slug doesn't change on update
        metadata: metadata || null,
        organizationId: existingDatabase.organizationId.value,
        ownerId: existingDatabase.ownerId.value,
        createdAt: existingDatabase.createdAt,
        updatedAt: new Date()
      });

      // Update database using repository
      const updateData = {
        name: dto.name,
        metadata: metadata
      };
      const savedDatabase = await this.databaseRepository.update(databaseId as any, updateData);

      return {
        success: true,
        data: DatabaseMapper.toDTO(savedDatabase)
      };
    } catch (error) {
      logger.error('Error updating database', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update database"
      };
    }
  }

  /**
   * Delete a database with safety checks
   */
  async deleteDatabase(databaseId: DatabaseId, organizationId: OrganizationId): Promise<Result<void>> {
    try {
      // Verify database exists and belongs to organization
      const database = await this.databaseRepository.findById(databaseId);
      if (!database) {
        return {
          success: false,
          error: `Database with ID ${databaseId} not found`
        };
      }

      if (database.organizationId.value !== organizationId.value) {
        return {
          success: false,
          error: "Access denied: Database does not belong to your organization"
        };
      }

      // Check if database has tables - prevent deletion if it does
      const tables = await this.tableRepository.findByDatabase(databaseId);

      if (tables.length > 0) {
        return {
          success: false,
          error: `Cannot delete database: it contains ${tables.length} table(s). Delete all tables first.`
        };
      }

      // Delete database
      await this.databaseRepository.delete(databaseId);

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      logger.error('Error deleting database', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete database"
      };
    }
  }

  /**
   * Get database by ID
   */
  async getDatabase(databaseId: DatabaseId): Promise<Database | null> {
    return await this.databaseRepository.findById(databaseId);
  }

  /**
   * Get databases with filtering and organization scoping
   */
  async getDatabases(filters: DatabaseFiltersDTO): Promise<DatabaseDTO[]> {
    try {
      // Convert DTO to Value Objects
      const organizationId = OrganizationId.fromNumber(filters.organizationId);

      let databases = await this.databaseRepository.findByOrganization(organizationId);

      // Apply agent scope filter
      // agentId === null means org-scoped only
      // agentId === number means agent-scoped only
      // agentId === undefined means all databases
      if (filters.agentId !== undefined) {
        if (filters.agentId === null) {
          // Only org-scoped databases (no agent)
          databases = databases.filter(db => db.agentId === null);
        } else {
          // Only databases for specific agent
          databases = databases.filter(db => db.agentId?.value === filters.agentId);
        }
      }

      // Apply search filter
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        databases = databases.filter(database =>
          database.name.toLowerCase().includes(searchLower) ||
          database.description?.toLowerCase().includes(searchLower) ||
          database.metadataText.toLowerCase().includes(searchLower)
        );
      }

      // Apply table filter
      if (filters.hasTables !== undefined) {
        const databasesWithTableCounts = await Promise.all(
          databases.map(async (database) => {
            const tables = await this.tableRepository.findByDatabase(database.id);
            return { database, tableCount: tables.length };
          })
        );

        databases = databasesWithTableCounts
          .filter(({ tableCount }) =>
            filters.hasTables ? tableCount > 0 : tableCount === 0
          )
          .map(({ database }) => database);
      }

      // Sort by creation date (newest first)
      databases.sort((a, b) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });

      // Convert to DTOs
      return databases.map(DatabaseMapper.toDTO);
    } catch (error) {
      logger.error('Error fetching databases', error);
      throw new Error("Failed to fetch databases");
    }
  }

  /**
   * Get database count for organization
   */
  async getDatabaseCount(organizationId: OrganizationId): Promise<number> {
    return await this.databaseRepository.countByOrganization(organizationId);
  }
}
