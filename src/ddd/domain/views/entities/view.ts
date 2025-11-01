/**
 * View Entity (Aggregate Root)
 *
 * AIDEV-NOTE: Represents a filtered/sorted view of a table (Baserow view pattern).
 * Formerly named DataSource - renamed to align with Baserow terminology.
 * Owns filters, sorting, pagination, field mappings, and view-type-specific configuration.
 * References a table but doesn't own it (follows DDD aggregate boundaries).
 *
 * Business Rules:
 * - View must reference a valid table
 * - Filters and sorting can be added/removed dynamically
 * - Pagination settings can be updated
 * - Name must be unique within an organization
 * - ViewType determines data transformation (grid, metric, dashboard, recent-entries)
 * - ViewConfig must match ViewType (validated)
 * - Aggregations computed via backend for metric/dashboard views
 */

import { ViewId } from "../value-objects/view-id";
import { FilterConfig } from "../value-objects/filter-config";
import { SortConfig } from "../value-objects/sort-config";
import { PaginationConfig } from "../value-objects/pagination-config";
import { FieldMapping } from "../value-objects/field-mapping";
import { ViewType } from "../value-objects/view-type";
import { ViewConfig, type ViewConfigData } from "../value-objects/view-config";
import { AggregationConfig } from "../value-objects/aggregation-config";
import { TableId } from "@/ddd/domain/shared/value-objects/table-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects/organization-id";

export interface ViewProps {
  id: ViewId;
  name: string;
  description?: string;
  viewType: ViewType;
  viewConfig: ViewConfig;
  tableId: TableId;
  organizationId: OrganizationId;
  filters?: FilterConfig[];
  sorting?: SortConfig[];
  pagination?: PaginationConfig;
  fieldMappings?: FieldMapping[];
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class View {
  private readonly _id: ViewId;
  private _name: string;
  private _description?: string;
  private readonly _viewType: ViewType;
  private _viewConfig: ViewConfig;
  private readonly _tableId: TableId;
  private readonly _organizationId: OrganizationId;
  private _filters: FilterConfig[];
  private _sorting: SortConfig[];
  private _pagination: PaginationConfig;
  private _fieldMappings: FieldMapping[];
  private readonly _createdBy?: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ViewProps) {
    this._id = props.id;
    this._name = props.name;
    this._description = props.description;
    this._viewType = props.viewType;
    this._viewConfig = props.viewConfig;
    this._tableId = props.tableId;
    this._organizationId = props.organizationId;
    this._filters = props.filters ?? [];
    this._sorting = props.sorting ?? [];
    this._pagination = props.pagination ?? PaginationConfig.createDefault();
    this._fieldMappings = props.fieldMappings ?? [];
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

    // Validate viewConfig type matches viewType
    if (this._viewType.isGrid() && !this._viewConfig.isGrid()) {
      throw new Error("Grid view type requires grid view configuration");
    }
    if (this._viewType.isMetric() && !this._viewConfig.isMetric()) {
      throw new Error("Metric view type requires metric view configuration");
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

  get fieldMappings(): readonly FieldMapping[] {
    return [...this._fieldMappings];
  }

  get viewType(): ViewType {
    return this._viewType;
  }

  get viewConfig(): ViewConfig {
    return this._viewConfig;
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
   * Set field mappings (replaces all existing mappings)
   */
  setFieldMappings(mappings: FieldMapping[]): void {
    this._fieldMappings = [...mappings];
    this._updatedAt = new Date();
  }

  /**
   * Add a field mapping
   */
  addFieldMapping(mapping: FieldMapping): void {
    const existingIndex = this._fieldMappings.findIndex(
      (m) => m.sourceFieldId === mapping.sourceFieldId
    );

    if (existingIndex >= 0) {
      throw new Error(
        `Field mapping for field ${mapping.sourceFieldId} already exists. Use updateFieldMapping instead.`
      );
    }

    this._fieldMappings.push(mapping);
    this._updatedAt = new Date();
  }

  /**
   * Update an existing field mapping
   */
  updateFieldMapping(sourceFieldId: number, newMapping: FieldMapping): void {
    const index = this._fieldMappings.findIndex((m) => m.sourceFieldId === sourceFieldId);

    if (index === -1) {
      throw new Error(`Field mapping for field ${sourceFieldId} not found`);
    }

    if (newMapping.sourceFieldId !== sourceFieldId) {
      throw new Error("Cannot change field mapping sourceFieldId. Remove and add a new mapping instead.");
    }

    this._fieldMappings[index] = newMapping;
    this._updatedAt = new Date();
  }

  /**
   * Remove a field mapping by field ID
   */
  removeFieldMapping(sourceFieldId: number): void {
    const initialLength = this._fieldMappings.length;
    this._fieldMappings = this._fieldMappings.filter((m) => m.sourceFieldId !== sourceFieldId);

    if (this._fieldMappings.length === initialLength) {
      throw new Error(`Field mapping for field ${sourceFieldId} not found`);
    }

    this._updatedAt = new Date();
  }

  /**
   * Remove all field mappings
   */
  clearFieldMappings(): void {
    this._fieldMappings = [];
    this._updatedAt = new Date();
  }

  /**
   * Get visible field mappings sorted by order
   */
  getVisibleFieldMappings(): readonly FieldMapping[] {
    return [...this._fieldMappings]
      .filter((m) => m.visible)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get sorted sorting configurations by priority
   */
  getSortedSorting(): readonly SortConfig[] {
    return [...this._sorting].sort((a, b) => a.comparePriority(b));
  }

  /**
   * Update view configuration
   * Validates that config type matches view type
   *
   * AIDEV-NOTE: ViewConfig must match ViewType. Grid views need grid config,
   * metric views need metric config, etc. This enforces type safety.
   */
  updateViewConfig(config: ViewConfig): void {
    // Validate config matches view type
    if (this._viewType.isGrid() && !config.isGrid()) {
      throw new Error("Grid view requires grid configuration");
    }
    if (this._viewType.isMetric() && !config.isMetric()) {
      throw new Error("Metric view requires metric configuration");
    }

    this._viewConfig = config;
    this._updatedAt = new Date();
  }

  /**
   * Get all aggregations for this view
   *
   * AIDEV-NOTE: This extracts aggregations from viewConfig for execution via gRPC.
   * - Grid views: return empty array (no aggregations)
   * - Metric views: return single aggregation
   * - Dashboard views: return all metrics' aggregations
   * - Recent entries views: return summary aggregations if configured
   */
  getAggregations(): readonly AggregationConfig[] {
    return this._viewConfig.getAggregations();
  }

  /**
   * Check if this view requires aggregation computation
   *
   * AIDEV-NOTE: Used by ViewApplicationService to determine if
   * executeAggregations should be called via gRPC backend.
   */
  requiresAggregation(): boolean {
    return this._viewType.requiresAggregation();
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
      viewType: this._viewType.toJSON(),
      viewConfig: this._viewConfig.toJSON(),
      tableId: this._tableId.value,
      organizationId: this._organizationId.value,
      filters: this._filters.map((f) => f.toJSON()),
      sorting: this._sorting.map((s) => s.toJSON()),
      pagination: this._pagination.toJSON(),
      fieldMappings: this._fieldMappings.map((m) => m.toJSON()),
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
    viewType: string;
    viewConfig: ViewConfigData;
    filters: Array<{ fieldId: number; operator: string; value?: string | number | boolean | null }>;
    sorting: Array<{ fieldId: number; direction: 'asc' | 'desc'; priority: number }>;
    pagination: { pageSize: number; offset: number };
    fieldMappings?: Array<{ sourceFieldId: number; displayName: string; visible: boolean; order: number }>;
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
      viewType: this._viewType.toString(),
      viewConfig: this._viewConfig.toJSON(),
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
      fieldMappings: this._fieldMappings.length > 0
        ? this._fieldMappings.map((m) => m.toJSON())
        : undefined,
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
    viewType: string;
    viewConfig: ViewConfigData;
    filters: Array<{ fieldId: number; operator: string; value?: string | number | boolean | null }>;
    sorting: Array<{ fieldId: number; direction: 'asc' | 'desc'; priority: number }>;
    pagination: { pageSize: number; offset: number };
    fieldMappings?: Array<{ sourceFieldId: number; displayName: string; visible: boolean; order: number }>;
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
      viewType: ViewType.create(data.viewType as any), // Type cast string to ViewTypeValue
      viewConfig: ViewConfig.fromJSON(data.viewConfig),
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
      fieldMappings: data.fieldMappings?.map((m) => FieldMapping.create({
        sourceFieldId: m.sourceFieldId,
        displayName: m.displayName,
        visible: m.visible,
        order: m.order,
      })),
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
