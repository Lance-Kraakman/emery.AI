// AIDEV-NOTE: App domain entity - aggregate root for applications
// Represents a container for pages with business rules and validation
// Implementation uses Puck visual page builder, but that's an infrastructure detail

import type { AppId } from '../value-objects/app-id';
import type { AppSlug } from '../value-objects/app-slug';
import type { PageId } from '../value-objects/page-id';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { ThemeConfig, type ThemeConfigProps } from '../value-objects/theme-config';

export class App {
  private constructor(
    private readonly _id: AppId,
    private readonly _organizationId: OrganizationId,
    private _name: string,
    private _slug: AppSlug,
    private _description: string | undefined,
    private _themeConfig: ThemeConfig | undefined,
    private _homePageId: PageId | undefined,
    private readonly _ownerId: UserId,
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

  get ownerId(): UserId {
    return this._ownerId;
  }

  // Backward compatibility alias
  get createdBy(): UserId {
    return this._ownerId;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  get themeConfig(): ThemeConfig {
    return this._themeConfig || ThemeConfig.default();
  }

  get homePageId(): PageId | undefined {
    return this._homePageId;
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
   * Update the app theme configuration
   */
  updateTheme(config: Partial<ThemeConfigProps> | undefined): void {
    this._themeConfig = config ? ThemeConfig.create(config) : undefined;
    this._updatedAt = new Date();
  }

  /**
   * Set the home page for this app
   */
  setHomePage(pageId: PageId | undefined): void {
    this._homePageId = pageId;
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
   * Create a new App (before persistence)
   * Used when creating a new app that hasn't been saved to the database yet
   */
  static create(data: {
    name: string;
    slug: AppSlug;
    description?: string;
    themeConfig?: Partial<ThemeConfigProps>;
    organizationId: OrganizationId;
    ownerId: UserId;
  }): App {
    // Import here to avoid circular dependencies
    const { AppId } = require('../value-objects/app-id');

    // Validate name
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('App name cannot be empty');
    }

    if (data.name.length > 100) {
      throw new Error('App name cannot exceed 100 characters');
    }

    // Validate description if provided
    if (data.description !== undefined && data.description.length > 500) {
      throw new Error('App description cannot exceed 500 characters');
    }

    const now = new Date();

    return new App(
      AppId.temporary(), // Temporary ID until persisted
      data.organizationId,
      data.name.trim(),
      data.slug,
      data.description,
      data.themeConfig ? ThemeConfig.create(data.themeConfig) : undefined,
      undefined, // No home page on creation
      data.ownerId,
      now,
      now
    );
  }

  /**
   * Create an App from persistence data
   */
  static fromPersistence(data: {
    id: number;
    organizationId: number;
    name: string;
    slug: string;
    description?: string;
    themeConfig?: any;
    homePageId?: number;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  }): App {
    // Import here to avoid circular dependencies
    const { AppId } = require('../value-objects/app-id');
    const { AppSlug } = require('../value-objects/app-slug');
    const { PageId } = require('../value-objects/page-id');

    const slugResult = AppSlug.create(data.slug);
    if (!slugResult.success) {
      throw new Error(`Invalid app slug in persistence data: ${slugResult.error}`);
    }

    return new App(
      AppId.fromNumber(data.id),
      OrganizationId.fromNumber(data.organizationId),
      data.name,
      slugResult.data,
      data.description,
      data.themeConfig ? ThemeConfig.fromJSON(data.themeConfig) : undefined,
      data.homePageId ? PageId.fromNumber(data.homePageId) : undefined,
      UserId.fromString(data.ownerId),
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
    themeConfig: any;
    homePageId: number | undefined;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this._id.value,
      organizationId: this._organizationId.value,
      name: this._name,
      slug: this._slug.value,
      description: this._description,
      themeConfig: this._themeConfig?.toJSON(),
      homePageId: this._homePageId?.value,
      ownerId: this._ownerId.value,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}
