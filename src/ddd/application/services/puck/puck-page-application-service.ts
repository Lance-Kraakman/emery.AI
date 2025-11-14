// AIDEV-NOTE: PuckPage Application Service - orchestrates page operations
// Handles page creation, updates, publishing, and ordering

import type { IPuckPageRepository } from '@/ddd/domain/puck/repositories/puck-page-repository';
import type { IAppRepository } from '@/ddd/domain/puck/repositories/app-repository';
import { PuckPage } from '@/ddd/domain/puck/entities/puck-page';
import { PageId } from '@/ddd/domain/puck/value-objects/page-id';
import { AppId } from '@/ddd/domain/puck/value-objects/app-id';
import { PageSlug } from '@/ddd/domain/puck/value-objects/page-slug';
import { PageOrder } from '@/ddd/domain/puck/value-objects/page-order';
import { PuckData } from '@/ddd/domain/puck/value-objects/puck-data';
import { PageSlugGenerator } from '@/ddd/domain/puck/services/page-slug-generator';
import { PageNavigationService, type NavigationItem } from '@/ddd/domain/puck/services/page-navigation-service';
import { UserId } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('PuckPageApplicationService');

// Command DTOs
export interface CreatePageCommand {
  appId: AppId;
  name: string;
  slug: string;
  description?: string;
  templateData?: any; // Puck JSON structure
  createdBy: UserId;
}

export interface UpdatePageCommand {
  id: PageId;
  name?: string;
  slug?: string;
  description?: string;
}

export interface UpdatePageContentCommand {
  id: PageId;
  templateData: any; // Puck JSON structure
}

export interface ReorderPagesCommand {
  appId: AppId;
  pageOrders: Array<{ pageId: number; order: number }>;
}

export class PuckPageApplicationService {
  private readonly slugGenerator: PageSlugGenerator;
  private readonly navigationService: PageNavigationService;

  constructor(
    private readonly pageRepository: IPuckPageRepository,
    private readonly appRepository: IAppRepository
  ) {
    this.slugGenerator = new PageSlugGenerator(pageRepository);
    this.navigationService = new PageNavigationService();
  }

  /**
   * Create a new page
   */
  async createPage(command: CreatePageCommand): Promise<Result<PuckPage>> {
    try {
      logger.debug('Creating page', { name: command.name, appId: command.appId.value });

      // 1. Validate app exists
      const app = await this.appRepository.findById(command.appId);
      if (!app) {
        return ResultHelpers.failure(`App ${command.appId.value} not found`);
      }

      // 2. Validate and create slug
      const slugResult = PageSlug.create(command.slug);
      if (!slugResult.success || !slugResult.data) {
        return ResultHelpers.failure(slugResult.error || 'Invalid slug');
      }

      const pageSlug = slugResult.data;

      // 3. Check slug uniqueness within app
      const slugExists = await this.pageRepository.existsBySlug(command.appId, pageSlug);
      if (slugExists) {
        return ResultHelpers.failure(`A page with slug '${command.slug}' already exists in this app`);
      }

      // 4. Get next order value
      const maxOrder = await this.pageRepository.getMaxOrder(command.appId);
      const orderResult = PageOrder.create(maxOrder + 1);
      if (!orderResult.success || !orderResult.data) {
        return ResultHelpers.failure('Failed to calculate page order');
      }

      const pageOrder = orderResult.data;

      // 5. Create or use empty template data
      let puckData: PuckData;
      if (command.templateData) {
        const dataResult = PuckData.create(command.templateData);
        if (!dataResult.success || !dataResult.data) {
          return ResultHelpers.failure(dataResult.error || 'Invalid template data');
        }
        puckData = dataResult.data;
      } else {
        puckData = PuckData.empty();
      }

      // 6. Create domain entity
      const page = PuckPage.fromPersistence({
        id: 0, // Will be set by database
        appId: command.appId.value,
        name: command.name,
        slug: command.slug,
        description: command.description,
        order: pageOrder.value,
        templateData: puckData.toDatabaseJson(),
        isPublic: false,
        requiresAuth: false,
        allowedRoles: undefined,
        createdBy: command.createdBy.value,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // 7. Save to repository
      const createdPage = await this.pageRepository.create(page);

      logger.summary(`Created page: ${createdPage.name} (ID: ${createdPage.id.value})`);

      return ResultHelpers.success(createdPage);
    } catch (error) {
      logger.error('Error creating page:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to create page');
    }
  }

  /**
   * Update page metadata (not content)
   */
  async updatePage(command: UpdatePageCommand): Promise<Result<PuckPage>> {
    try {
      logger.debug('Updating page', { id: command.id.value });

      // 1. Get existing page
      const page = await this.pageRepository.findById(command.id);
      if (!page) {
        return ResultHelpers.failure(`Page ${command.id.value} not found`);
      }

      // 2. Apply updates
      if (command.name) {
        page.updateName(command.name);
      }

      if (command.slug) {
        const slugResult = PageSlug.create(command.slug);
        if (!slugResult.success || !slugResult.data) {
          return ResultHelpers.failure(slugResult.error || 'Invalid slug');
        }

        const newSlug = slugResult.data;

        // Check slug uniqueness (excluding current page)
        const existingPage = await this.pageRepository.findBySlug(page.appId, newSlug);
        if (existingPage && !existingPage.id.equals(page.id)) {
          return ResultHelpers.failure(`A page with slug '${command.slug}' already exists`);
        }

        page.updateSlug(newSlug);
      }

      if (command.description !== undefined) {
        page.updateDescription(command.description);
      }

      // 3. Save updates
      const updatedPage = await this.pageRepository.update(page);

      logger.summary(`Updated page: ${updatedPage.name}`);

      return ResultHelpers.success(updatedPage);
    } catch (error) {
      logger.error('Error updating page:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to update page');
    }
  }

  /**
   * Update page template data (Puck content)
   */
  async updatePageContent(command: UpdatePageContentCommand): Promise<Result<PuckPage>> {
    try {
      logger.debug('Updating page content', { id: command.id.value });

      // 1. Get existing page
      const page = await this.pageRepository.findById(command.id);
      if (!page) {
        return ResultHelpers.failure(`Page ${command.id.value} not found`);
      }

      // 2. Validate and create PuckData
      const dataResult = PuckData.create(command.templateData);
      if (!dataResult.success || !dataResult.data) {
        return ResultHelpers.failure(dataResult.error || 'Invalid template data');
      }

      // 3. Update template data
      page.updateTemplateData(dataResult.data);

      // 4. Save updates
      const updatedPage = await this.pageRepository.update(page);

      logger.summary(`Updated page content: ${updatedPage.name}`);

      return ResultHelpers.success(updatedPage);
    } catch (error) {
      logger.error('Error updating page content:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to update page content');
    }
  }

  /**
   * Publish a page (make it publicly visible)
   */
  async publishPage(id: PageId): Promise<Result<PuckPage>> {
    try {
      logger.debug('Publishing page', { id: id.value });

      // 1. Get existing page
      const page = await this.pageRepository.findById(id);
      if (!page) {
        return ResultHelpers.failure(`Page ${id.value} not found`);
      }

      // 2. Publish (domain enforces business rules)
      page.publish();

      // 3. Save updates
      const publishedPage = await this.pageRepository.update(page);

      logger.summary(`Published page: ${publishedPage.name}`);

      return ResultHelpers.success(publishedPage);
    } catch (error) {
      logger.error('Error publishing page:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to publish page');
    }
  }

  /**
   * Unpublish a page (make it a draft)
   */
  async unpublishPage(id: PageId): Promise<Result<PuckPage>> {
    try {
      logger.debug('Unpublishing page', { id: id.value });

      // 1. Get existing page
      const page = await this.pageRepository.findById(id);
      if (!page) {
        return ResultHelpers.failure(`Page ${id.value} not found`);
      }

      // 2. Unpublish
      page.unpublish();

      // 3. Save updates
      const unpublishedPage = await this.pageRepository.update(page);

      logger.summary(`Unpublished page: ${unpublishedPage.name}`);

      return ResultHelpers.success(unpublishedPage);
    } catch (error) {
      logger.error('Error unpublishing page:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to unpublish page');
    }
  }

  /**
   * Delete a page
   */
  async deletePage(id: PageId): Promise<Result<void>> {
    try {
      logger.debug('Deleting page', { id: id.value });

      // 1. Verify page exists
      const page = await this.pageRepository.findById(id);
      if (!page) {
        return ResultHelpers.failure(`Page ${id.value} not found`);
      }

      // 2. Check if page can be deleted (business rule)
      if (!page.canBeDeleted()) {
        return ResultHelpers.failure('Page cannot be deleted at this time');
      }

      // 3. Delete page
      await this.pageRepository.delete(id);

      logger.summary(`Deleted page: ${page.name} (ID: ${id.value})`);

      return ResultHelpers.success(undefined);
    } catch (error) {
      logger.error('Error deleting page:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to delete page');
    }
  }

  /**
   * Reorder pages within an app
   */
  async reorderPages(command: ReorderPagesCommand): Promise<Result<void>> {
    try {
      logger.debug('Reordering pages', { appId: command.appId.value, count: command.pageOrders.length });

      // 1. Validate app exists
      const app = await this.appRepository.findById(command.appId);
      if (!app) {
        return ResultHelpers.failure(`App ${command.appId.value} not found`);
      }

      // 2. Create order map with value objects
      const orderMap = new Map<PageId, PageOrder>();
      for (const { pageId, order } of command.pageOrders) {
        const pageIdVO = PageId.fromNumber(pageId);
        const orderResult = PageOrder.create(order);

        if (!orderResult.success || !orderResult.data) {
          return ResultHelpers.failure(`Invalid order value: ${order}`);
        }

        orderMap.set(pageIdVO, orderResult.data);
      }

      // 3. Update orders in repository (uses transaction)
      await this.pageRepository.reorderPages(command.appId, orderMap);

      logger.summary(`Reordered ${command.pageOrders.length} pages in app ${command.appId.value}`);

      return ResultHelpers.success(undefined);
    } catch (error) {
      logger.error('Error reordering pages:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to reorder pages');
    }
  }

  /**
   * Get a page by ID
   */
  async getPage(id: PageId): Promise<PuckPage | null> {
    try {
      return await this.pageRepository.findById(id);
    } catch (error) {
      logger.error('Error getting page:', error);
      return null;
    }
  }

  /**
   * Get a page by slug within an app
   */
  async getPageBySlug(appId: AppId, slug: string): Promise<PuckPage | null> {
    try {
      const slugResult = PageSlug.create(slug);
      if (!slugResult.success || !slugResult.data) {
        return null;
      }

      return await this.pageRepository.findBySlug(appId, slugResult.data);
    } catch (error) {
      logger.error('Error getting page by slug:', error);
      return null;
    }
  }

  /**
   * Get all pages for an app
   */
  async getPagesByApp(appId: AppId): Promise<PuckPage[]> {
    try {
      return await this.pageRepository.findByApp(appId);
    } catch (error) {
      logger.error('Error getting pages by app:', error);
      return [];
    }
  }

  /**
   * Get published pages for an app
   */
  async getPublishedPages(appId: AppId): Promise<PuckPage[]> {
    try {
      return await this.pageRepository.findPublishedByApp(appId);
    } catch (error) {
      logger.error('Error getting published pages:', error);
      return [];
    }
  }

  /**
   * Build navigation structure for an app
   */
  async buildNavigation(appId: AppId, publishedOnly: boolean = false): Promise<NavigationItem[]> {
    try {
      const pages = publishedOnly
        ? await this.pageRepository.findPublishedByApp(appId)
        : await this.pageRepository.findByApp(appId);

      return publishedOnly
        ? this.navigationService.buildPublishedNavigation(pages)
        : this.navigationService.buildNavigation(pages);
    } catch (error) {
      logger.error('Error building navigation:', error);
      return [];
    }
  }

  /**
   * Generate a unique slug from a page name
   */
  async generateSlugFromName(appId: AppId, name: string): Promise<Result<string>> {
    try {
      const slugResult = await this.slugGenerator.generateFromName(appId, name);
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
   * Count pages for an app
   */
  async countPages(appId: AppId): Promise<number> {
    try {
      return await this.pageRepository.countByApp(appId);
    } catch (error) {
      logger.error('Error counting pages:', error);
      return 0;
    }
  }
}
