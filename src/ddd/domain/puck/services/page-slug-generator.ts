// AIDEV-NOTE: Domain service for generating unique page slugs
// Stateless service that handles page slug generation logic

import type { PageSlug } from '../value-objects/page-slug';
import type { AppId } from '../value-objects/app-id';
import type { IPuckPageRepository } from '../repositories/puck-page-repository';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';

export class PageSlugGenerator {
  constructor(private readonly pageRepository: IPuckPageRepository) {}

  /**
   * Generate a unique slug for a page within an app
   * If the base slug exists, appends a number (e.g., "/about-2")
   */
  async generateUniqueSlug(
    appId: AppId,
    baseSlug: PageSlug
  ): Promise<Result<PageSlug>> {
    // Import PageSlug here to avoid circular dependency
    const { PageSlug: PageSlugClass } = require('../value-objects/page-slug');

    // Check if base slug is available
    const exists = await this.pageRepository.existsBySlug(appId, baseSlug);
    if (!exists) {
      return ResultHelpers.success(baseSlug);
    }

    // Try appending numbers until we find an available slug
    const baseValue = baseSlug.value;

    for (let i = 2; i <= 100; i++) {
      const candidateSlug = `${baseValue}-${i}`;
      const slugResult = PageSlugClass.create(candidateSlug);

      if (!slugResult.success) {
        continue; // Skip invalid slugs
      }

      const candidateExists = await this.pageRepository.existsBySlug(
        appId,
        slugResult.data
      );

      if (!candidateExists) {
        return ResultHelpers.success(slugResult.data);
      }
    }

    return ResultHelpers.failure(
      'Could not generate a unique slug after 100 attempts. Please try a different name.'
    );
  }

  /**
   * Generate a slug from a page name and ensure it's unique
   */
  async generateFromName(
    appId: AppId,
    name: string
  ): Promise<Result<PageSlug>> {
    const { PageSlug: PageSlugClass } = require('../value-objects/page-slug');

    // Generate base slug from name
    const baseSlugResult = PageSlugClass.fromName(name);
    if (!baseSlugResult.success) {
      return baseSlugResult;
    }

    // Make it unique
    return this.generateUniqueSlug(appId, baseSlugResult.data);
  }
}
