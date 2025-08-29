/**
 * Database Application Service
 * 
 * Orchestrates database lifecycle operations for logical data organization.
 * Handles database creation, updates, deletion, and business validation.
 * Databases serve as logical namespaces/workspaces for grouping related tables.
 */

import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import { Database } from '@/ddd/domain/databases/entities/database';
import type { Result } from '@/ddd/domain/shared/result';
import { DatabaseId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

export interface CreateDatabaseCommand {
  name: string;
  description?: string;
  organizationId: OrganizationId;
  createdBy: UserId;
  metadata?: Record<string, any>;
}

export interface UpdateDatabaseCommand {
  databaseId: DatabaseId;
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface DatabaseFilters {
  organizationId: OrganizationId;
  searchQuery?: string;
  hasTables?: boolean;
}


// Use unified Result interface from domain shared types
export type DatabaseApplicationResult<T = any> = Result<T>;

export class DatabaseApplicationService {
  constructor(
    private readonly tableRepository: IDynamicTableRepository,
    private readonly databaseRepository: IDatabaseRepository
  ) {}

  /**
   * Create a new database with business validation
   */
  async createDatabase(command: CreateDatabaseCommand): Promise<DatabaseApplicationResult<Database>> {
    try {
      // Business validation
      if (!command.name?.trim()) {
        return {
          success: false,
          error: "Database name is required"
        };
      }

      // Create URL-safe slug
      const baseSlug = command.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Ensure unique slug within organization
      let slug = baseSlug;
      let counter = 1;
      while (!(await this.databaseRepository.isSlugUnique(command.organizationId, slug))) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Prepare metadata
      const metadata = command.description 
        ? { description: command.description, ...command.metadata }
        : command.metadata || null;

      // Create database using domain entity
      const database = Database.create({
        name: command.name.trim(),
        slug,
        metadata,
        organizationId: command.organizationId,
        createdBy: command.createdBy
      });

      // Save to repository and get the created entity with ID
      const savedDatabase = await this.databaseRepository.save(database);

      return {
        success: true,
        data: savedDatabase
      };
    } catch (error) {
      console.error("Error creating database:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create database"
      };
    }
  }

  /**
   * Update an existing database
   */
  async updateDatabase(command: UpdateDatabaseCommand): Promise<DatabaseApplicationResult<Database>> {
    try {
      // Load existing database
      const existingDatabase = await this.databaseRepository.findById(command.databaseId);
      if (!existingDatabase) {
        return {
          success: false,
          error: `Database with ID ${command.databaseId} not found`
        };
      }

      // Prepare updated metadata
      let metadata = existingDatabase.metadata;
      if (command.description !== undefined || command.metadata !== undefined) {
        metadata = {
          ...metadata,
          ...command.metadata
        };
        if (command.description !== undefined) {
          if (command.description) {
            metadata = { ...metadata, description: command.description };
          } else {
            // Remove description if explicitly set to empty
            const { description, ...rest } = metadata || {};
            metadata = rest;
          }
        }
      }

      // Create updated database
      const updatedDatabase = Database.fromPersistence({
        id: existingDatabase.id,
        name: command.name !== undefined ? command.name : existingDatabase.name,
        slug: existingDatabase.slug, // Slug doesn't change on update
        metadata: metadata || null,
        organizationId: existingDatabase.organizationId,
        createdBy: existingDatabase.createdBy,
        createdAt: existingDatabase.createdAt,
        updatedAt: new Date()
      });

      // Save updated database
      await this.databaseRepository.save(updatedDatabase);

      return {
        success: true,
        data: updatedDatabase
      };
    } catch (error) {
      console.error("Error updating database:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update database"
      };
    }
  }

  /**
   * Delete a database with safety checks
   */
  async deleteDatabase(databaseId: DatabaseId, organizationId: OrganizationId): Promise<DatabaseApplicationResult<void>> {
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
      const tables = await this.tableRepository.findByDatabase(DatabaseId.fromNumber(databaseId));

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
      console.error("Error deleting database:", error);
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
  async getDatabases(filters: DatabaseFilters): Promise<Database[]> {
    try {
      let databases = await this.databaseRepository.findByOrganization(filters.organizationId);

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
            const tables = await this.tableRepository.findByDatabase(DatabaseId.fromNumber(database.id));
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

      return databases;
    } catch (error) {
      console.error("Error fetching databases:", error);
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
