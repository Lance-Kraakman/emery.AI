// AIDEV-NOTE: Template domain entity - reusable component tree templates
// Represents a saved template of Puck components that can be inserted into pages

import type { TemplateId } from '../value-objects/template-id';
import type { AppId } from '../value-objects/app-id';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { PuckDataStructure } from '../value-objects/puck-data';
import type { TemplateVariant } from '@/lib/db/schema';

export type TemplateData = PuckDataStructure['content'];

// Re-export types for convenience
export type { TemplateVariant } from '@/lib/db/schema';

export class Template {
  private constructor(
    private readonly _id: TemplateId,
    private readonly _organizationId: OrganizationId | null, // null for system templates
    private readonly _appId: AppId | null, // null = org-wide, set = app-specific
    private _name: string,
    private _description: string | undefined,
    private _category: string | undefined,
    private readonly _isSystem: boolean, // true = pre-seeded system template
    private _thumbnailUrl: string | undefined,
    private _data: TemplateData,
    private _variants: TemplateVariant[],
    private readonly _createdBy: UserId | null, // null for system templates
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  // Getters
  get id(): TemplateId {
    return this._id;
  }

  get organizationId(): OrganizationId | null {
    return this._organizationId;
  }

  get isSystem(): boolean {
    return this._isSystem;
  }

  get appId(): AppId | null {
    return this._appId;
  }

  get name(): string {
    return this._name;
  }

  get description(): string | undefined {
    return this._description;
  }

  get category(): string | undefined {
    return this._category;
  }

  get thumbnailUrl(): string | undefined {
    return this._thumbnailUrl;
  }

  get data(): TemplateData {
    return this._data;
  }

  get variants(): TemplateVariant[] {
    return this._variants;
  }

  /**
   * Check if this template has multiple variants
   */
  get hasVariants(): boolean {
    return this._variants.length > 1;
  }

  /**
   * Get the default variant (first one marked as default, or first variant)
   */
  get defaultVariant(): TemplateVariant | undefined {
    return this._variants.find(v => v.isDefault) ?? this._variants[0];
  }

  get createdBy(): UserId | null {
    return this._createdBy;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  /**
   * Check if this is an organization-wide template
   */
  get isOrgWide(): boolean {
    return this._appId === null;
  }

  // Business methods

  /**
   * Update the template name
   */
  updateName(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Template name cannot be empty');
    }

    if (newName.length > 100) {
      throw new Error('Template name cannot exceed 100 characters');
    }

    this._name = newName.trim();
    this._updatedAt = new Date();
  }

  /**
   * Update the template description
   */
  updateDescription(newDescription: string | undefined): void {
    if (newDescription !== undefined && newDescription.length > 500) {
      throw new Error('Template description cannot exceed 500 characters');
    }

    this._description = newDescription;
    this._updatedAt = new Date();
  }

  /**
   * Update the template category
   */
  updateCategory(newCategory: string | undefined): void {
    if (newCategory !== undefined && newCategory.length > 50) {
      throw new Error('Template category cannot exceed 50 characters');
    }

    this._category = newCategory;
    this._updatedAt = new Date();
  }

  /**
   * Update the template thumbnail URL
   */
  updateThumbnailUrl(newUrl: string | undefined): void {
    this._thumbnailUrl = newUrl;
    this._updatedAt = new Date();
  }

  /**
   * Update the template component data
   */
  updateData(newData: TemplateData): void {
    if (!Array.isArray(newData)) {
      throw new Error('Template data must be an array');
    }

    this._data = newData;
    this._updatedAt = new Date();
  }

  /**
   * Update variants
   */
  updateVariants(variants: TemplateVariant[]): void {
    this._variants = variants;
    this._updatedAt = new Date();
  }

  /**
   * Add a new variant
   */
  addVariant(variant: TemplateVariant): void {
    // Ensure unique ID
    if (this._variants.some(v => v.id === variant.id)) {
      throw new Error(`Variant with id "${variant.id}" already exists`);
    }
    this._variants.push(variant);
    this._updatedAt = new Date();
  }

  /**
   * Remove a variant by ID
   */
  removeVariant(variantId: string): void {
    const index = this._variants.findIndex(v => v.id === variantId);
    if (index === -1) {
      throw new Error(`Variant with id "${variantId}" not found`);
    }
    this._variants.splice(index, 1);
    this._updatedAt = new Date();
  }

  /**
   * Get a variant by ID
   */
  getVariant(variantId: string): TemplateVariant | undefined {
    return this._variants.find(v => v.id === variantId);
  }

  /**
   * Check if the template is owned by a specific organization
   */
  isOwnedBy(organizationId: OrganizationId): boolean {
    return this._organizationId?.equals(organizationId) ?? false;
  }

  /**
   * Check if the template was created by a specific user
   */
  wasCreatedBy(userId: UserId): boolean {
    return this._createdBy?.equals(userId) ?? false;
  }

  // Factory methods

  /**
   * Create a new Template (before persistence)
   * Used when creating a new template that hasn't been saved to the database yet
   */
  static create(data: {
    name: string;
    description?: string;
    category?: string;
    thumbnailUrl?: string;
    data: TemplateData;
    variants?: TemplateVariant[];
    organizationId: OrganizationId;
    appId?: AppId | null;
    createdBy: UserId;
  }): Template {
    // Import here to avoid circular dependencies
    const { TemplateId } = require('../value-objects/template-id');

    // Validate name
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Template name cannot be empty');
    }

    if (data.name.length > 100) {
      throw new Error('Template name cannot exceed 100 characters');
    }

    // Validate description if provided
    if (data.description !== undefined && data.description.length > 500) {
      throw new Error('Template description cannot exceed 500 characters');
    }

    // Validate category if provided
    if (data.category !== undefined && data.category.length > 50) {
      throw new Error('Template category cannot exceed 50 characters');
    }

    // Validate data
    if (!Array.isArray(data.data)) {
      throw new Error('Template data must be an array');
    }

    const now = new Date();

    return new Template(
      TemplateId.temporary(), // Temporary ID until persisted
      data.organizationId,
      data.appId ?? null,
      data.name.trim(),
      data.description,
      data.category,
      false, // User-created templates are never system templates
      data.thumbnailUrl,
      data.data,
      data.variants ?? [],
      data.createdBy,
      now,
      now
    );
  }

  /**
   * Create a Template from persistence data
   */
  static fromPersistence(data: {
    id: number;
    organizationId: number | null;
    appId?: number | null;
    name: string;
    description?: string | null;
    category?: string | null;
    isSystem?: boolean;
    thumbnailUrl?: string | null;
    data: TemplateData;
    variants?: TemplateVariant[] | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Template {
    // Import here to avoid circular dependencies
    const { TemplateId } = require('../value-objects/template-id');
    const { AppId } = require('../value-objects/app-id');

    return new Template(
      TemplateId.fromNumber(data.id),
      data.organizationId ? OrganizationId.fromNumber(data.organizationId) : null,
      data.appId ? AppId.fromNumber(data.appId) : null,
      data.name,
      data.description ?? undefined,
      data.category ?? undefined,
      data.isSystem ?? false,
      data.thumbnailUrl ?? undefined,
      data.data,
      data.variants ?? [],
      data.createdBy ? UserId.fromString(data.createdBy) : null,
      data.createdAt,
      data.updatedAt
    );
  }

  /**
   * Convert to persistence format
   */
  toPersistence(): {
    id: number;
    organizationId: number | null;
    appId: number | null;
    name: string;
    description: string | undefined;
    category: string | undefined;
    isSystem: boolean;
    thumbnailUrl: string | undefined;
    data: TemplateData;
    variants: TemplateVariant[];
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this._id.value,
      organizationId: this._organizationId?.value ?? null,
      appId: this._appId?.value ?? null,
      name: this._name,
      description: this._description,
      category: this._category,
      isSystem: this._isSystem,
      thumbnailUrl: this._thumbnailUrl,
      data: this._data,
      variants: this._variants,
      createdBy: this._createdBy?.value ?? null,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}
