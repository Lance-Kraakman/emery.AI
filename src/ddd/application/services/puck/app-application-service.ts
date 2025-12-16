// AIDEV-NOTE: App Application Service - orchestrates app operations
// Handles business logic, validation, and coordination between domain and infrastructure
// Uses Puck for visual page building, but that's an implementation detail

import type { IAppRepository, SidebarAppDTO } from '@/ddd/domain/puck/repositories/app-repository';
import type { IPuckPageRepository } from '@/ddd/domain/puck/repositories/puck-page-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { App } from '@/ddd/domain/puck/entities/app';
import { AppId } from '@/ddd/domain/puck/value-objects/app-id';
import { AppSlug } from '@/ddd/domain/puck/value-objects/app-slug';
import { AppSlugGenerator } from '@/ddd/domain/puck/services/app-slug-generator';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('AppApplicationService');

// Command DTOs
export interface CreateAppCommand {
  name: string;
  slug: string;
  description?: string;
  organizationId: OrganizationId;
  ownerId: UserId;
}

export interface UpdateAppCommand {
  id: AppId;
  name?: string;
  slug?: string;
  description?: string;
}

// Response DTOs
export interface AppWithPagesDTO {
  app: App;
  pageCount: number;
}

export class AppApplicationService {
  private readonly slugGenerator: AppSlugGenerator;

  constructor(
    private readonly appRepository: IAppRepository,
    private readonly pageRepository: IPuckPageRepository,
    private readonly organizationRepository: IOrganizationRepository
  ) {
    this.slugGenerator = new AppSlugGenerator(appRepository);
  }

  /**
   * Create a new app
   */
  async createApp(command: CreateAppCommand): Promise<Result<App>> {
    try {
      logger.debug('Creating app', { name: command.name, orgId: command.organizationId.value });

      // 1. Validate organization exists
      const organization = await this.organizationRepository.findById(command.organizationId);
      if (!organization) {
        return ResultHelpers.failure(`Organization ${command.organizationId.value} not found`);
      }

      // 2. Validate and create slug
      const slugResult = AppSlug.create(command.slug);
      if (!slugResult.success || !slugResult.data) {
        return ResultHelpers.failure(slugResult.error || 'Invalid slug');
      }

      const appSlug = slugResult.data;

      // 3. Check slug uniqueness
      const slugExists = await this.appRepository.existsBySlug(command.organizationId, appSlug);
      if (slugExists) {
        return ResultHelpers.failure(`An app with slug '${command.slug}' already exists in this organization`);
      }

      // 4. Create domain entity (without ID - will be set by repository)
      const app = App.create({
        name: command.name,
        slug: appSlug,
        description: command.description,
        organizationId: command.organizationId,
        ownerId: command.ownerId
      });

      // 5. Save to repository
      const createdApp = await this.appRepository.create(app);

      logger.summary(`Created app: ${createdApp.name} (ID: ${createdApp.id.value})`);

      return ResultHelpers.success(createdApp);
    } catch (error) {
      logger.error('Error creating app:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to create app');
    }
  }

  /**
   * Update an existing app
   */
  async updateApp(command: UpdateAppCommand): Promise<Result<App>> {
    try {
      logger.debug('Updating app', { id: command.id.value });

      // 1. Get existing app
      const app = await this.appRepository.findById(command.id);
      if (!app) {
        return ResultHelpers.failure(`App ${command.id.value} not found`);
      }

      // 2. Apply updates
      if (command.name) {
        app.updateName(command.name);
      }

      if (command.slug) {
        const slugResult = AppSlug.create(command.slug);
        if (!slugResult.success || !slugResult.data) {
          return ResultHelpers.failure(slugResult.error || 'Invalid slug');
        }

        const newSlug = slugResult.data;

        // Check slug uniqueness (excluding current app)
        const existingApp = await this.appRepository.findBySlug(app.organizationId, newSlug);
        if (existingApp && !existingApp.id.equals(app.id)) {
          return ResultHelpers.failure(`An app with slug '${command.slug}' already exists`);
        }

        app.updateSlug(newSlug);
      }

      if (command.description !== undefined) {
        app.updateDescription(command.description);
      }

      // 3. Save updates
      const updatedApp = await this.appRepository.update(app);

      logger.summary(`Updated app: ${updatedApp.name}`);

      return ResultHelpers.success(updatedApp);
    } catch (error) {
      logger.error('Error updating app:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to update app');
    }
  }

  /**
   * Delete an app (cascade deletes all pages)
   */
  async deleteApp(id: AppId): Promise<Result<void>> {
    try {
      logger.debug('Deleting app', { id: id.value });

      // 1. Verify app exists
      const app = await this.appRepository.findById(id);
      if (!app) {
        return ResultHelpers.failure(`App ${id.value} not found`);
      }

      // 2. Check if app can be deleted (business rule)
      if (!app.canBeDeleted()) {
        return ResultHelpers.failure('App cannot be deleted at this time');
      }

      // 3. Delete app (pages will cascade delete via FK constraint)
      await this.appRepository.delete(id);

      logger.summary(`Deleted app: ${app.name} (ID: ${id.value})`);

      return ResultHelpers.success(undefined);
    } catch (error) {
      logger.error('Error deleting app:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to delete app');
    }
  }

  /**
   * Get an app by ID
   */
  async getApp(id: AppId): Promise<App | null> {
    try {
      return await this.appRepository.findById(id);
    } catch (error) {
      logger.error('Error getting app:', error);
      return null;
    }
  }

  /**
   * Get an app by slug within an organization
   */
  async getAppBySlug(organizationId: OrganizationId, slug: string): Promise<App | null> {
    try {
      const slugResult = AppSlug.create(slug);
      if (!slugResult.success || !slugResult.data) {
        return null;
      }

      return await this.appRepository.findBySlug(organizationId, slugResult.data);
    } catch (error) {
      logger.error('Error getting app by slug:', error);
      return null;
    }
  }

  /**
   * Get all apps for an organization
   */
  async getAppsByOrganization(organizationId: OrganizationId): Promise<App[]> {
    try {
      return await this.appRepository.findByOrganization(organizationId);
    } catch (error) {
      logger.error('Error getting apps by organization:', error);
      return [];
    }
  }

  /**
   * Get an app with its page count
   */
  async getAppWithPages(id: AppId): Promise<AppWithPagesDTO | null> {
    try {
      const app = await this.appRepository.findById(id);
      if (!app) {
        return null;
      }

      const pageCount = await this.pageRepository.countByApp(id);

      return {
        app,
        pageCount
      };
    } catch (error) {
      logger.error('Error getting app with pages:', error);
      return null;
    }
  }

  /**
   * Generate a unique slug from an app name
   */
  async generateSlugFromName(organizationId: OrganizationId, name: string): Promise<Result<string>> {
    try {
      const slugResult = await this.slugGenerator.generateFromName(organizationId, name);
      if (!slugResult.success || !slugResult.data) {
        return ResultHelpers.failure(slugResult.error || 'Failed to generate slug');
      }

      return ResultHelpers.success(slugResult.data.value);
    } catch (error) {
      logger.error('Error generating slug:', error);
      return ResultHelpers.failure('Failed to generate slug');
    }
  }

  /**
   * Count apps for an organization
   */
  async countApps(organizationId: OrganizationId): Promise<number> {
    try {
      return await this.appRepository.countByOrganization(organizationId);
    } catch (error) {
      logger.error('Error counting apps:', error);
      return 0;
    }
  }

  /**
   * Get all apps for an organization with their pages (for sidebar)
   * Uses optimized 2-query approach instead of N+1
   */
  async getAppsWithPagesForOrganization(organizationId: OrganizationId): Promise<SidebarAppDTO[]> {
    try {
      return await this.appRepository.findByOrganizationWithPages(organizationId);
    } catch (error) {
      logger.error('Error getting apps with pages:', error);
      return [];
    }
  }
}
