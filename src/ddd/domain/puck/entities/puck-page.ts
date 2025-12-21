// AIDEV-NOTE: PuckPage domain entity representing a page within a Puck app
// Contains template data inline (no separate template entity)

import type { PageId } from '../value-objects/page-id';
import type { AppId } from '../value-objects/app-id';
import type { PageSlug } from '../value-objects/page-slug';
import type { PageOrder } from '../value-objects/page-order';
import type { PuckData } from '../value-objects/puck-data';
import { UserId } from '@/ddd/domain/shared/value-objects';
import { ThemeConfig, type ThemeConfigProps } from '../value-objects/theme-config';
import type { PageVariable, PageStateConfig } from '@/components/puck/types';

export class PuckPage {
  private constructor(
    private readonly _id: PageId,
    private readonly _appId: AppId,
    private _name: string,
    private _slug: PageSlug,
    private _description: string | undefined,
    private _order: PageOrder,
    private _templateData: PuckData,
    private _themeConfig: ThemeConfig | undefined,
    private _isPublic: boolean,
    private _requiresAuth: boolean,
    private _allowedRoles: string[] | undefined,
    private _pageVariables: PageVariable[] | undefined,
    private _pageState: PageStateConfig | undefined,
    private readonly _ownerId: UserId,
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

  get isPublic(): boolean {
    return this._isPublic;
  }

  get requiresAuth(): boolean {
    return this._requiresAuth;
  }

  get allowedRoles(): string[] | undefined {
    return this._allowedRoles ? [...this._allowedRoles] : undefined;
  }

  get pageVariables(): PageVariable[] | undefined {
    return this._pageVariables ? [...this._pageVariables] : undefined;
  }

  get pageState(): PageStateConfig | undefined {
    return this._pageState ? { ...this._pageState } : undefined;
  }

  get ownerId(): UserId {
    return this._ownerId;
  }

  get createdBy(): UserId {
    return this._ownerId; // Backward compatibility alias
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  get themeConfig(): ThemeConfig | undefined {
    return this._themeConfig;
  }

  /**
   * Get the effective theme by merging with app theme
   * Page theme overrides take precedence
   */
  getEffectiveTheme(appTheme: ThemeConfig): ThemeConfig {
    if (!this._themeConfig) {
      return appTheme;
    }
    return ThemeConfig.merge(appTheme, this._themeConfig);
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
   * Update the page theme configuration (override app theme)
   * Pass undefined to clear the override and use app theme
   */
  updateTheme(config: Partial<ThemeConfigProps> | undefined): void {
    this._themeConfig = config ? ThemeConfig.create(config) : undefined;
    this._updatedAt = new Date();
  }

  /**
   * Make the page public (publicly accessible)
   */
  makePublic(): void {
    if (this._isPublic) {
      return; // Already public, no-op
    }

    // Business rule: Can make public if template data is not empty
    if (this._templateData.isEmpty()) {
      throw new Error('Cannot make a page public with empty template data');
    }

    this._isPublic = true;
    this._updatedAt = new Date();
  }

  /**
   * Make the page private (draft mode)
   */
  makePrivate(): void {
    if (!this._isPublic) {
      return; // Already private, no-op
    }

    this._isPublic = false;
    this._updatedAt = new Date();
  }

  /**
   * Update authentication requirement
   */
  setRequiresAuth(requiresAuth: boolean): void {
    this._requiresAuth = requiresAuth;
    this._updatedAt = new Date();
  }

  /**
   * Update allowed roles for access control
   */
  setAllowedRoles(roles: string[] | undefined): void {
    this._allowedRoles = roles && roles.length > 0 ? [...roles] : undefined;
    this._updatedAt = new Date();
  }

  /**
   * Update page variables (expected query parameters)
   */
  setPageVariables(variables: PageVariable[] | undefined): void {
    this._pageVariables = variables && variables.length > 0 ? [...variables] : undefined;
    this._updatedAt = new Date();
  }

  /**
   * Update page state configuration (client-side state)
   */
  setPageState(config: PageStateConfig | undefined): void {
    this._pageState = config ? { ...config } : undefined;
    this._updatedAt = new Date();
  }

  /**
   * Check if a user with specific roles can access this page
   */
  canBeAccessedByRoles(userRoles: string[]): boolean {
    // If no auth required, anyone can access
    if (!this._requiresAuth) {
      return true;
    }

    // If auth required but no role restrictions, any authenticated user can access
    if (!this._allowedRoles || this._allowedRoles.length === 0) {
      return true;
    }

    // Check if user has any of the allowed roles
    return userRoles.some(role => this._allowedRoles!.includes(role));
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
    themeConfig?: any;
    isPublic: boolean;
    requiresAuth: boolean;
    allowedRoles?: string[];
    pageVariables?: PageVariable[];
    pageState?: PageStateConfig;
    ownerId: string;
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

    // AIDEV-NOTE: Use PageId.create() for new entities (id = 0) to bypass validation
    const pageId = data.id === 0 ? PageId.create() : PageId.fromNumber(data.id);

    return new PuckPage(
      pageId,
      AppId.fromNumber(data.appId),
      data.name,
      slugResult.data,
      data.description,
      orderResult.data,
      puckDataResult.data,
      data.themeConfig ? ThemeConfig.fromJSON(data.themeConfig) : undefined,
      data.isPublic,
      data.requiresAuth,
      data.allowedRoles,
      data.pageVariables,
      data.pageState,
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
    appId: number;
    name: string;
    slug: string;
    description: string | undefined;
    order: number;
    templateData: any;
    themeConfig: any;
    isPublic: boolean;
    requiresAuth: boolean;
    allowedRoles: string[] | undefined;
    pageVariables: PageVariable[] | undefined;
    pageState: PageStateConfig | undefined;
    ownerId: string;
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
      themeConfig: this._themeConfig?.toJSON(),
      isPublic: this._isPublic,
      requiresAuth: this._requiresAuth,
      allowedRoles: this._allowedRoles,
      pageVariables: this._pageVariables,
      pageState: this._pageState,
      ownerId: this._ownerId.value,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}
