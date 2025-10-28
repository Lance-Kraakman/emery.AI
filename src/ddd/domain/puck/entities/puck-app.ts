// AIDEV-NOTE: PuckApp domain entity - aggregate root for Puck applications
// Represents a container for pages with business rules and validation

import type { AppId } from '../value-objects/app-id';
import type { AppSlug } from '../value-objects/app-slug';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

export class PuckApp {
  private constructor(
    private readonly _id: AppId,
    private readonly _organizationId: OrganizationId,
    private _name: string,
    private _slug: AppSlug,
    private _description: string | undefined,
    private readonly _createdBy: UserId,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  // Getters
  get id(): AppId {
    return this._id;
  }

  get organizationId(): OrganizationId {
    return this._organizationId;
  }

  get name(): string {
    return this._name;
  }

  get slug(): AppSlug {
    return this._slug;
  }

  get description(): string | undefined {
    return this._description;
  }

  get createdBy(): UserId {
    return this._createdBy;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  // Business methods

  /**
   * Update the app name
   */
  updateName(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('App name cannot be empty');
    }

    if (newName.length > 100) {
      throw new Error('App name cannot exceed 100 characters');
    }

    this._name = newName.trim();
    this._updatedAt = new Date();
  }

  /**
   * Update the app slug
   */
  updateSlug(newSlug: AppSlug): void {
    this._slug = newSlug;
    this._updatedAt = new Date();
  }

  /**
   * Update the app description
   */
  updateDescription(newDescription: string | undefined): void {
    if (newDescription !== undefined && newDescription.length > 500) {
      throw new Error('App description cannot exceed 500 characters');
    }

    this._description = newDescription;
    this._updatedAt = new Date();
  }

  /**
   * Check if the app is owned by a specific organization
   */
  isOwnedBy(organizationId: OrganizationId): boolean {
    return this._organizationId.equals(organizationId);
  }

  /**
   * Check if the app can be deleted
   * Business rule: Apps can always be deleted (pages cascade)
   */
  canBeDeleted(): boolean {
    return true;
  }

  /**
   * Touch the updatedAt timestamp (useful for tracking changes)
   */
  touch(): void {
    this._updatedAt = new Date();
  }

  // Factory methods

  /**
   * Create a PuckApp from persistence data
   */
  static fromPersistence(data: {
    id: number;
    organizationId: number;
    name: string;
    slug: string;
    description?: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): PuckApp {
    // Import here to avoid circular dependencies
    const { AppId } = require('../value-objects/app-id');
    const { AppSlug } = require('../value-objects/app-slug');

    const slugResult = AppSlug.create(data.slug);
    if (!slugResult.success) {
      throw new Error(`Invalid app slug in persistence data: ${slugResult.error}`);
    }

    return new PuckApp(
      AppId.fromNumber(data.id),
      OrganizationId.fromNumber(data.organizationId),
      data.name,
      slugResult.data,
      data.description,
      UserId.fromString(data.createdBy),
      data.createdAt,
      data.updatedAt
    );
  }

  /**
   * Convert to persistence format
   */
  toPersistence(): {
    id: number;
    organizationId: number;
    name: string;
    slug: string;
    description: string | undefined;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this._id.value,
      organizationId: this._organizationId.value,
      name: this._name,
      slug: this._slug.value,
      description: this._description,
      createdBy: this._createdBy.value,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}
