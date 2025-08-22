// AIDEV-NOTE: RAG Index domain entity
// Core business entity representing a RAG index with domain rules

import { RagIndexId, OrganizationId, type DomainType, type IndexStatus } from '../value-objects';

export interface RagIndexCreationParams {
  name: string;
  description?: string;
  organizationId: OrganizationId;
  agentId?: number;
  roleId?: number;
  domainTypes: DomainType[];
  domainFilters?: Record<string, any>;
  embeddingModel?: string;
  embeddingDimensions?: number;
  createdBy: string;
}

export interface RagIndexUpdateParams {
  name?: string;
  description?: string;
  domainTypes?: DomainType[];
  domainFilters?: Record<string, any>;
  status?: IndexStatus;
}

export class RagIndex {
  private constructor(
    private readonly _id: RagIndexId,
    private readonly _organizationId: OrganizationId,
    private _name: string,
    private _description: string | undefined,
    private readonly _agentId: number | undefined,
    private readonly _roleId: number | undefined,
    private _domainTypes: DomainType[],
    private _domainFilters: Record<string, any> | undefined,
    private readonly _embeddingModel: string,
    private readonly _embeddingDimensions: number,
    private _status: IndexStatus,
    private _documentCount: number,
    private readonly _createdBy: string,
    private readonly _createdAt: Date,
    private _lastIndexedAt: Date | undefined
  ) {}

  // Getters
  get id(): RagIndexId {
    return this._id;
  }

  get organizationId(): OrganizationId {
    return this._organizationId;
  }

  get name(): string {
    return this._name;
  }

  get description(): string | undefined {
    return this._description;
  }

  get agentId(): number | undefined {
    return this._agentId;
  }

  get roleId(): number | undefined {
    return this._roleId;
  }

  get domainTypes(): DomainType[] {
    return [...this._domainTypes]; // Return copy to prevent mutation
  }

  get domainFilters(): Record<string, any> | undefined {
    return this._domainFilters ? { ...this._domainFilters } : undefined;
  }

  get embeddingModel(): string {
    return this._embeddingModel;
  }

  get embeddingDimensions(): number {
    return this._embeddingDimensions;
  }

  get status(): IndexStatus {
    return this._status;
  }

  get documentCount(): number {
    return this._documentCount;
  }

  get createdBy(): string {
    return this._createdBy;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get lastIndexedAt(): Date | undefined {
    return this._lastIndexedAt ? new Date(this._lastIndexedAt) : undefined;
  }

  // Business methods
  updateDetails(params: RagIndexUpdateParams): void {
    if (params.name !== undefined) {
      this.validateName(params.name);
      this._name = params.name;
    }

    if (params.description !== undefined) {
      this._description = params.description;
    }

    if (params.domainTypes !== undefined) {
      this.validateDomainTypes(params.domainTypes);
      this._domainTypes = [...params.domainTypes];
    }

    if (params.domainFilters !== undefined) {
      this._domainFilters = params.domainFilters ? { ...params.domainFilters } : undefined;
    }

    if (params.status !== undefined) {
      this._status = params.status;
    }
  }

  startIndexing(): void {
    if (this._status === 'building') {
      throw new Error('Index is already being built');
    }
    this._status = 'building';
  }

  completeIndexing(documentCount: number): void {
    if (this._status !== 'building') {
      throw new Error('Index is not currently being built');
    }
    this._status = 'active';
    this._documentCount = Math.max(0, documentCount);
    this._lastIndexedAt = new Date();
  }

  failIndexing(): void {
    if (this._status !== 'building') {
      throw new Error('Index is not currently being built');
    }
    this._status = 'error';
  }

  pause(): void {
    if (this._status !== 'active') {
      throw new Error('Only active indexes can be paused');
    }
    this._status = 'paused';
  }

  resume(): void {
    if (this._status !== 'paused') {
      throw new Error('Only paused indexes can be resumed');
    }
    this._status = 'active';
  }

  canBeDeleted(): boolean {
    return this._status !== 'building';
  }

  includesDomainType(domainType: DomainType): boolean {
    return this._domainTypes.includes(domainType);
  }

  isOwnedBy(organizationId: OrganizationId): boolean {
    return this._organizationId.equals(organizationId);
  }

  isAssignedToAgent(agentId: number): boolean {
    return this._agentId === agentId;
  }

  isAssignedToRole(roleId: number): boolean {
    return this._roleId === roleId;
  }

  // Factory methods
  static create(params: RagIndexCreationParams): RagIndex {
    // Validate input parameters
    this.validateName(params.name);
    this.validateDomainTypes(params.domainTypes);

    const id = RagIndexId.create();
    const embeddingModel = params.embeddingModel || 'sentence-transformers/all-mpnet-base-v2';
    const embeddingDimensions = params.embeddingDimensions || 768;

    return new RagIndex(
      id,
      params.organizationId,
      params.name,
      params.description,
      params.agentId,
      params.roleId,
      [...params.domainTypes],
      params.domainFilters ? { ...params.domainFilters } : undefined,
      embeddingModel,
      embeddingDimensions,
      'created',
      0,
      params.createdBy,
      new Date(),
      undefined
    );
  }

  static fromPersistence(data: {
    id: string;
    organizationId: number;
    name: string;
    description?: string;
    agentId?: number;
    roleId?: number;
    domainTypes: DomainType[];
    domainFilters?: Record<string, any>;
    embeddingModel: string;
    embeddingDimensions: number;
    status: IndexStatus;
    documentCount: number;
    createdBy: string;
    createdAt: Date;
    lastIndexedAt?: Date;
  }): RagIndex {
    return new RagIndex(
      RagIndexId.fromString(data.id),
      OrganizationId.fromNumber(data.organizationId),
      data.name,
      data.description,
      data.agentId,
      data.roleId,
      [...data.domainTypes],
      data.domainFilters ? { ...data.domainFilters } : undefined,
      data.embeddingModel,
      data.embeddingDimensions,
      data.status,
      data.documentCount,
      data.createdBy,
      data.createdAt,
      data.lastIndexedAt
    );
  }

  // Validation methods
  private static validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Index name cannot be empty');
    }
    if (name.length > 100) {
      throw new Error('Index name cannot exceed 100 characters');
    }
  }

  private validateName(name: string): void {
    RagIndex.validateName(name);
  }

  private static validateDomainTypes(domainTypes: DomainType[]): void {
    if (!domainTypes || domainTypes.length === 0) {
      throw new Error('At least one domain type must be specified');
    }

    const validDomainTypes: DomainType[] = [
      'table', 'file', 'agent', 'team', 'organization', 'database'
    ];

    for (const domainType of domainTypes) {
      if (!validDomainTypes.includes(domainType)) {
        throw new Error(`Invalid domain type: ${domainType}`);
      }
    }
  }

  private validateDomainTypes(domainTypes: DomainType[]): void {
    RagIndex.validateDomainTypes(domainTypes);
  }

  // Conversion method for persistence
  toPersistence(): {
    id: string;
    organizationId: number;
    name: string;
    description?: string;
    agentId?: number;
    roleId?: number;
    domainTypes: DomainType[];
    domainFilters?: Record<string, any>;
    embeddingModel: string;
    embeddingDimensions: number;
    status: IndexStatus;
    documentCount: number;
    createdBy: string;
    createdAt: Date;
    lastIndexedAt?: Date;
  } {
    return {
      id: this._id.value,
      organizationId: this._organizationId.value,
      name: this._name,
      description: this._description,
      agentId: this._agentId,
      roleId: this._roleId,
      domainTypes: [...this._domainTypes],
      domainFilters: this._domainFilters ? { ...this._domainFilters } : undefined,
      embeddingModel: this._embeddingModel,
      embeddingDimensions: this._embeddingDimensions,
      status: this._status,
      documentCount: this._documentCount,
      createdBy: this._createdBy,
      createdAt: this._createdAt,
      lastIndexedAt: this._lastIndexedAt
    };
  }
}