/**
 * View Entity (Aggregate Root)
 *
 * AIDEV-NOTE: Represents a filtered/sorted view of a table (Baserow view pattern).
 * Formerly named DataSource - renamed to align with Baserow terminology.
 * Owns filters, sorting, and pagination configurations.
 * References a table but doesn't own it (follows DDD aggregate boundaries).
 *
 * Business Rules:
 * - View must reference a valid table
 * - Filters and sorting can be added/removed dynamically
 * - Pagination settings can be updated
 * - Name must be unique within an organization
 */

import { ViewId } from "../value-objects/view-id";
import { FilterConfig } from "../value-objects/filter-config";
import { SortConfig } from "../value-objects/sort-config";
import { PaginationConfig } from "../value-objects/pagination-config";
import { TableId } from "@/ddd/domain/shared/value-objects/table-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects/organization-id";

export interface ViewProps {
  id: ViewId;
  name: string;
  description?: string;
  tableId: TableId;
  organizationId: OrganizationId;
  filters?: FilterConfig[];
  sorting?: SortConfig[];
  pagination?: PaginationConfig;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class View {
  private readonly _id: ViewId;
  private _name: string;
  private _description?: string;
  private readonly _tableId: TableId;
  private readonly _organizationId: OrganizationId;
  private _filters: FilterConfig[];
  private _sorting: SortConfig[];
  private _pagination: PaginationConfig;
  private readonly _createdBy?: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ViewProps) {
    this._id = props.id;
    this._name = props.name;
    this._description = props.description;
    this._tableId = props.tableId;
    this._organizationId = props.organizationId;
    this._filters = props.filters ?? [];
    this._sorting = props.sorting ?? [];
    this._pagination = props.pagination ?? PaginationConfig.createDefault();
    this._createdBy = props.createdBy;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();

    this.validate();
  }

  static create(props: Omit<ViewProps, "id" | "createdAt" | "updatedAt">): View {
    // For new entities, we use newEntity() which creates ID with value 0
    // The repository will assign the actual ID upon persistence
    return new View({
      ...props,
      id: ViewId.newEntity(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: ViewProps): View {
    return new View(props);
  }

  private validate(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw new Error("View name cannot be empty");
    }

    if (this._name.length > 255) {
      throw new Error("View name cannot exceed 255 characters");
    }

    // Validate that field IDs in filters exist in the table
    // Note: This validation should ideally be done with the actual table schema
    // but we'll keep the entity decoupled from the repository layer
  }

  // Getters
  get id(): ViewId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get description(): string | undefined {
    return this._description;
  }

  get tableId(): TableId {
    return this._tableId;
  }

  get createdBy(): string | undefined {
    return this._createdBy;
  }

  get organizationId(): OrganizationId {
    return this._organizationId;
  }

  get filters(): readonly FilterConfig[] {
    return [...this._filters];
  }

  get sorting(): readonly SortConfig[] {
    return [...this._sorting];
  }

  get pagination(): PaginationConfig {
    return this._pagination;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business Methods

  /**
   * Update the view name
   */
  updateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error("View name cannot be empty");
    }
    if (name.length > 255) {
      throw new Error("View name cannot exceed 255 characters");
    }
    this._name = name;
    this._updatedAt = new Date();
  }

  /**
   * Update the view description
   */
  updateDescription(description?: string): void {
    this._description = description;
    this._updatedAt = new Date();
  }

  /**
   * Add a filter to the view
   */
  addFilter(filter: FilterConfig): void {
    // Check if a filter for this field already exists
    const existingIndex = this._filters.findIndex(
      (f) => f.fieldId === filter.fieldId
    );

    if (existingIndex >= 0) {
      throw new Error(
        `Filter for field ${filter.fieldId} already exists. Use updateFilter instead.`
      );
    }

    this._filters.push(filter);
    this._updatedAt = new Date();
  }

  /**
   * Update an existing filter
   */
  updateFilter(fieldId: number, newFilter: FilterConfig): void {
    const index = this._filters.findIndex((f) => f.fieldId === fieldId);

    if (index === -1) {
      throw new Error(`Filter for field ${fieldId} not found`);
    }

    if (newFilter.fieldId !== fieldId) {
      throw new Error("Cannot change filter field ID. Remove and add a new filter instead.");
    }

    this._filters[index] = newFilter;
    this._updatedAt = new Date();
  }

  /**
   * Remove a filter by field ID
   */
  removeFilter(fieldId: number): void {
    const initialLength = this._filters.length;
    this._filters = this._filters.filter((f) => f.fieldId !== fieldId);

    if (this._filters.length === initialLength) {
      throw new Error(`Filter for field ${fieldId} not found`);
    }

    this._updatedAt = new Date();
  }

  /**
   * Remove all filters
   */
  clearFilters(): void {
    this._filters = [];
    this._updatedAt = new Date();
  }

  /**
   * Add a sort configuration
   */
  addSorting(sort: SortConfig): void {
    // Check if sorting for this field already exists
    const existingIndex = this._sorting.findIndex(
      (s) => s.fieldId === sort.fieldId
    );

    if (existingIndex >= 0) {
      throw new Error(
        `Sorting for field ${sort.fieldId} already exists. Use updateSorting instead.`
      );
    }

    this._sorting.push(sort);
    // Re-sort by priority
    this._sorting.sort((a, b) => a.comparePriority(b));
    this._updatedAt = new Date();
  }

  /**
   * Update an existing sort configuration
   */
  updateSorting(fieldId: number, newSort: SortConfig): void {
    const index = this._sorting.findIndex((s) => s.fieldId === fieldId);

    if (index === -1) {
      throw new Error(`Sorting for field ${fieldId} not found`);
    }

    if (newSort.fieldId !== fieldId) {
      throw new Error("Cannot change sort field ID. Remove and add a new sort instead.");
    }

    this._sorting[index] = newSort;
    // Re-sort by priority
    this._sorting.sort((a, b) => a.comparePriority(b));
    this._updatedAt = new Date();
  }

  /**
   * Remove a sort configuration by field ID
   */
  removeSorting(fieldId: number): void {
    const initialLength = this._sorting.length;
    this._sorting = this._sorting.filter((s) => s.fieldId !== fieldId);

    if (this._sorting.length === initialLength) {
      throw new Error(`Sorting for field ${fieldId} not found`);
    }

    this._updatedAt = new Date();
  }

  /**
   * Remove all sorting configurations
   */
  clearSorting(): void {
    this._sorting = [];
    this._updatedAt = new Date();
  }

  /**
   * Update pagination configuration
   */
  updatePagination(pagination: PaginationConfig): void {
    this._pagination = pagination;
    this._updatedAt = new Date();
  }

  /**
   * Get sorted sorting configurations by priority
   */
  getSortedSorting(): readonly SortConfig[] {
    return [...this._sorting].sort((a, b) => a.comparePriority(b));
  }

  /**
   * Check if view has any filters
   */
  hasFilters(): boolean {
    return this._filters.length > 0;
  }

  /**
   * Check if view has any sorting
   */
  hasSorting(): boolean {
    return this._sorting.length > 0;
  }

  /**
   * Convert to JSON for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this._id.value,
      name: this._name,
      tableId: this._tableId.value,
      organizationId: this._organizationId.value,
      filters: this._filters.map((f) => f.toJSON()),
      sorting: this._sorting.map((s) => s.toJSON()),
      pagination: this._pagination.toJSON(),
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  /**
   * Convert to persistence format for database storage
   */
  toPersistence(): {
    id: number;
    organizationId: number;
    tableId: number;
    name: string;
    description?: string;
    filters: Array<{ fieldId: number; operator: string; value?: string | number | boolean | null }>;
    sorting: Array<{ fieldId: number; direction: 'asc' | 'desc'; priority: number }>;
    pagination: { pageSize: number; offset: number };
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this._id.value,
      organizationId: this._organizationId.value,
      tableId: this._tableId.value,
      name: this._name,
      description: this._description,
      filters: this._filters.map((f) => f.toJSON()),
      sorting: this._sorting.map((s) => ({
        fieldId: s.fieldId,
        direction: s.direction,
        priority: s.priority,
      })),
      pagination: {
        pageSize: this._pagination.pageSize,
        offset: this._pagination.offset,
      },
      createdBy: this._createdBy,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * Reconstitute from persistence format
   */
  static fromPersistence(data: {
    id: number;
    organizationId: number;
    tableId: number;
    name: string;
    description?: string;
    filters: Array<{ fieldId: number; operator: string; value?: string | number | boolean | null }>;
    sorting: Array<{ fieldId: number; direction: 'asc' | 'desc'; priority: number }>;
    pagination: { pageSize: number; offset: number };
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
  }): View {
    return View.reconstitute({
      id: ViewId.fromNumber(data.id),
      organizationId: OrganizationId.fromNumber(data.organizationId),
      tableId: TableId.fromNumber(data.tableId),
      name: data.name,
      description: data.description,
      filters: data.filters.map((f) => FilterConfig.create({
        fieldId: f.fieldId,
        operator: f.operator as any, // Type cast operator string to FilterOperator
        value: f.value,
      })),
      sorting: data.sorting.map((s) => SortConfig.create({
        fieldId: s.fieldId,
        direction: s.direction,
        priority: s.priority,
      })),
      pagination: PaginationConfig.create({
        pageSize: data.pagination.pageSize,
        offset: data.pagination.offset,
      }),
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
