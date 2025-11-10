// AIDEV-NOTE: Domain service for generating unique app slugs
// Stateless service that handles slug generation logic

import type { AppSlug } from '../value-objects/app-slug';
import type { IAppRepository } from '../repositories/app-repository';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';

export class AppSlugGenerator {
  constructor(private readonly appRepository: IAppRepository) {}

  /**
   * Generate a unique slug for an app within an organization
   * If the base slug exists, appends a number (e.g., "my-app-2")
   */
  async generateUniqueSlug(
    organizationId: OrganizationId,
    baseSlug: AppSlug
  ): Promise<Result<AppSlug>> {
    // Import AppSlug here to avoid circular dependency
    const { AppSlug: AppSlugClass } = require('../value-objects/app-slug');

    // Check if base slug is available
    const exists = await this.appRepository.existsBySlug(organizationId, baseSlug);
    if (!exists) {
      return ResultHelpers.success(baseSlug);
    }

    // Try appending numbers until we find an available slug
    for (let i = 2; i <= 100; i++) {
      const candidateSlug = `${baseSlug.value}-${i}`;
      const slugResult = AppSlugClass.create(candidateSlug);

      if (!slugResult.success) {
        continue; // Skip invalid slugs
      }

      const candidateExists = await this.appRepository.existsBySlug(
        organizationId,
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
   * Generate a slug from an app name and ensure it's unique
   */
  async generateFromName(
    organizationId: OrganizationId,
    name: string
  ): Promise<Result<AppSlug>> {
    const { AppSlug: AppSlugClass } = require('../value-objects/app-slug');

    // Generate base slug from name
    const baseSlugResult = AppSlugClass.fromName(name);
    if (!baseSlugResult.success) {
      return baseSlugResult;
    }

    // Make it unique
    return this.generateUniqueSlug(organizationId, baseSlugResult.data);
  }
}
