// AIDEV-NOTE: PuckPage domain entity representing a page within a Puck app
// Contains template data inline (no separate template entity)

import type { PageId } from '../value-objects/page-id';
import type { AppId } from '../value-objects/app-id';
import type { PageSlug } from '../value-objects/page-slug';
import type { PageOrder } from '../value-objects/page-order';
import type { PuckData } from '../value-objects/puck-data';
import { UserId } from '@/ddd/domain/shared/value-objects';

export class PuckPage {
  private constructor(
    private readonly _id: PageId,
    private readonly _appId: AppId,
    private _name: string,
    private _slug: PageSlug,
    private _description: string | undefined,
    private _order: PageOrder,
    private _templateData: PuckData,
    private _isPublished: boolean,
    private readonly _createdBy: UserId,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  // Getters
  get id(): PageId {
    return this._id;
  }

  get appId(): AppId {
    return this._appId;
  }

  get name(): string {
    return this._name;
  }

  get slug(): PageSlug {
    return this._slug;
  }

  get description(): string | undefined {
    return this._description;
  }

  get order(): PageOrder {
    return this._order;
  }

  get templateData(): PuckData {
    return this._templateData;
  }

  get isPublished(): boolean {
    return this._isPublished;
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
   * Update the page name
   */
  updateName(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Page name cannot be empty');
    }

    if (newName.length > 100) {
      throw new Error('Page name cannot exceed 100 characters');
    }

    this._name = newName.trim();
    this._updatedAt = new Date();
  }

  /**
   * Update the page slug
   */
  updateSlug(newSlug: PageSlug): void {
    this._slug = newSlug;
    this._updatedAt = new Date();
  }

  /**
   * Update the page description
   */
  updateDescription(newDescription: string | undefined): void {
    if (newDescription !== undefined && newDescription.length > 500) {
      throw new Error('Page description cannot exceed 500 characters');
    }

    this._description = newDescription;
    this._updatedAt = new Date();
  }

  /**
   * Update the page order
   */
  updateOrder(newOrder: PageOrder): void {
    this._order = newOrder;
    this._updatedAt = new Date();
  }

  /**
   * Update the template data (Puck JSON)
   */
  updateTemplateData(newData: PuckData): void {
    this._templateData = newData;
    this._updatedAt = new Date();
  }

  /**
   * Publish the page (make it publicly visible)
   */
  publish(): void {
    if (this._isPublished) {
      return; // Already published, no-op
    }

    // Business rule: Can publish if template data is not empty
    if (this._templateData.isEmpty()) {
      throw new Error('Cannot publish a page with empty template data');
    }

    this._isPublished = true;
    this._updatedAt = new Date();
  }

  /**
   * Unpublish the page (make it a draft)
   */
  unpublish(): void {
    if (!this._isPublished) {
      return; // Already unpublished, no-op
    }

    this._isPublished = false;
    this._updatedAt = new Date();
  }

  /**
   * Check if the page belongs to a specific app
   */
  belongsToApp(appId: AppId): boolean {
    return this._appId.equals(appId);
  }

  /**
   * Check if the page can be deleted
   */
  canBeDeleted(): boolean {
    return true; // Pages can always be deleted
  }

  /**
   * Touch the updatedAt timestamp
   */
  touch(): void {
    this._updatedAt = new Date();
  }

  // Factory methods

  /**
   * Create a PuckPage from persistence data
   */
  static fromPersistence(data: {
    id: number;
    appId: number;
    name: string;
    slug: string;
    description?: string;
    order: number;
    templateData: any;
    isPublished: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): PuckPage {
    // Import here to avoid circular dependencies
    const { PageId } = require('../value-objects/page-id');
    const { AppId } = require('../value-objects/app-id');
    const { PageSlug } = require('../value-objects/page-slug');
    const { PageOrder } = require('../value-objects/page-order');
    const { PuckData } = require('../value-objects/puck-data');

    const slugResult = PageSlug.create(data.slug);
    if (!slugResult.success) {
      throw new Error(`Invalid page slug in persistence data: ${slugResult.error}`);
    }

    const orderResult = PageOrder.create(data.order);
    if (!orderResult.success) {
      throw new Error(`Invalid page order in persistence data: ${orderResult.error}`);
    }

    const puckDataResult = PuckData.create(data.templateData);
    if (!puckDataResult.success) {
      throw new Error(`Invalid template data in persistence data: ${puckDataResult.error}`);
    }

    return new PuckPage(
      PageId.fromNumber(data.id),
      AppId.fromNumber(data.appId),
      data.name,
      slugResult.data,
      data.description,
      orderResult.data,
      puckDataResult.data,
      data.isPublished,
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
    appId: number;
    name: string;
    slug: string;
    description: string | undefined;
    order: number;
    templateData: any;
    isPublished: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this._id.value,
      appId: this._appId.value,
      name: this._name,
      slug: this._slug.value,
      description: this._description,
      order: this._order.value,
      templateData: this._templateData.toDatabaseJson(),
      isPublished: this._isPublished,
      createdBy: this._createdBy.value,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}
