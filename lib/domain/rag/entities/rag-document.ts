// AIDEV-NOTE: RAG Document domain entity
// Represents an indexed document with content and embeddings

import { DocumentId, RagIndexId, OrganizationId, type SourceType } from '../value-objects';

export interface DocumentMetadata {
  [key: string]: any;
}

export interface RagDocumentCreationParams {
  indexId: RagIndexId;
  organizationId: OrganizationId;
  sourceId: string;
  sourceType: SourceType;
  sourceName: string;
  title: string;
  content: string;
  metadata?: DocumentMetadata;
  embedding: number[];
  contentHash: string;
}

export interface RagDocumentUpdateParams {
  title?: string;
  content?: string;
  metadata?: DocumentMetadata;
  embedding?: number[];
  contentHash?: string;
}

export class RagDocument {
  private constructor(
    private readonly _id: DocumentId,
    private readonly _indexId: RagIndexId,
    private readonly _organizationId: OrganizationId,
    private readonly _sourceId: string,
    private readonly _sourceType: SourceType,
    private readonly _sourceName: string,
    private _title: string,
    private _content: string,
    private _metadata: DocumentMetadata,
    private _embedding: number[],
    private _contentHash: string,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _similarity?: number
  ) {}

  // Getters
  get id(): DocumentId {
    return this._id;
  }

  get indexId(): RagIndexId {
    return this._indexId;
  }

  get organizationId(): OrganizationId {
    return this._organizationId;
  }

  get sourceId(): string {
    return this._sourceId;
  }

  get sourceType(): SourceType {
    return this._sourceType;
  }

  get sourceName(): string {
    return this._sourceName;
  }

  get title(): string {
    return this._title;
  }

  get content(): string {
    return this._content;
  }

  get metadata(): DocumentMetadata {
    return { ...this._metadata }; // Return copy to prevent mutation
  }

  get embedding(): number[] {
    return [...this._embedding]; // Return copy to prevent mutation
  }

  get contentHash(): string {
    return this._contentHash;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  get similarity(): number | undefined {
    return this._similarity;
  }

  // Business methods
  updateContent(params: RagDocumentUpdateParams): void {
    let hasChanges = false;

    if (params.title !== undefined) {
      this.validateTitle(params.title);
      this._title = params.title;
      hasChanges = true;
    }

    if (params.content !== undefined) {
      this.validateContent(params.content);
      this._content = params.content;
      hasChanges = true;
    }

    if (params.metadata !== undefined) {
      this._metadata = { ...params.metadata };
      hasChanges = true;
    }

    if (params.embedding !== undefined) {
      this.validateEmbedding(params.embedding);
      this._embedding = [...params.embedding];
      hasChanges = true;
    }

    if (params.contentHash !== undefined) {
      this._contentHash = params.contentHash;
      hasChanges = true;
    }

    if (hasChanges) {
      this._updatedAt = new Date();
    }
  }

  setSimilarity(similarity: number): void {
    if (similarity < 0 || similarity > 1) {
      throw new Error('Similarity score must be between 0 and 1');
    }
    this._similarity = similarity;
  }

  clearSimilarity(): void {
    this._similarity = undefined;
  }

  belongsToIndex(indexId: RagIndexId): boolean {
    return this._indexId.equals(indexId);
  }

  belongsToOrganization(organizationId: OrganizationId): boolean {
    return this._organizationId.equals(organizationId);
  }

  isFromSource(sourceId: string, sourceType: SourceType): boolean {
    return this._sourceId === sourceId && this._sourceType === sourceType;
  }

  hasContentChanged(contentHash: string): boolean {
    return this._contentHash !== contentHash;
  }

  getEmbeddingDimensions(): number {
    return this._embedding.length;
  }

  getContentLength(): number {
    return this._content.length;
  }

  // Factory methods
  static create(params: RagDocumentCreationParams): RagDocument {
    // Validate input parameters
    this.validateTitle(params.title);
    this.validateContent(params.content);
    this.validateEmbedding(params.embedding);
    this.validateContentHash(params.contentHash);

    const id = DocumentId.create();
    const now = new Date();

    return new RagDocument(
      id,
      params.indexId,
      params.organizationId,
      params.sourceId,
      params.sourceType,
      params.sourceName,
      params.title,
      params.content,
      params.metadata || {},
      [...params.embedding],
      params.contentHash,
      now,
      now,
      undefined
    );
  }

  static fromPersistence(data: {
    id: string;
    indexId: string;
    organizationId: number;
    sourceId: string;
    sourceType: SourceType;
    sourceName: string;
    title: string;
    content: string;
    metadata: DocumentMetadata;
    embedding: number[];
    contentHash: string;
    createdAt: Date;
    updatedAt: Date;
    similarity?: number;
  }): RagDocument {
    return new RagDocument(
      DocumentId.fromString(data.id),
      RagIndexId.fromString(data.indexId),
      OrganizationId.fromNumber(data.organizationId),
      data.sourceId,
      data.sourceType,
      data.sourceName,
      data.title,
      data.content,
      { ...data.metadata },
      [...data.embedding],
      data.contentHash,
      data.createdAt,
      data.updatedAt,
      data.similarity
    );
  }

  // Validation methods
  private static validateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new Error('Document title cannot be empty');
    }
    if (title.length > 500) {
      throw new Error('Document title cannot exceed 500 characters');
    }
  }

  private validateTitle(title: string): void {
    RagDocument.validateTitle(title);
  }

  private static validateContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new Error('Document content cannot be empty');
    }
    if (content.length > 1000000) { // 1MB limit
      throw new Error('Document content cannot exceed 1MB');
    }
  }

  private validateContent(content: string): void {
    RagDocument.validateContent(content);
  }

  private static validateEmbedding(embedding: number[]): void {
    if (!embedding || embedding.length === 0) {
      throw new Error('Document embedding cannot be empty');
    }
    if (embedding.some(value => !Number.isFinite(value))) {
      throw new Error('Document embedding must contain only finite numbers');
    }
  }

  private validateEmbedding(embedding: number[]): void {
    RagDocument.validateEmbedding(embedding);
  }

  private static validateContentHash(contentHash: string): void {
    if (!contentHash || contentHash.trim().length === 0) {
      throw new Error('Document content hash cannot be empty');
    }
    // Basic MD5 hash format validation
    const md5Regex = /^[a-f0-9]{32}$/i;
    if (!md5Regex.test(contentHash)) {
      throw new Error('Document content hash must be a valid MD5 hash');
    }
  }

  // Conversion method for persistence
  toPersistence(): {
    id: string;
    indexId: string;
    organizationId: number;
    sourceId: string;
    sourceType: SourceType;
    sourceName: string;
    title: string;
    content: string;
    metadata: DocumentMetadata;
    embedding: number[];
    contentHash: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this._id.value,
      indexId: this._indexId.value,
      organizationId: this._organizationId.value,
      sourceId: this._sourceId,
      sourceType: this._sourceType,
      sourceName: this._sourceName,
      title: this._title,
      content: this._content,
      metadata: { ...this._metadata },
      embedding: [...this._embedding],
      contentHash: this._contentHash,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }

  // Serialization for search results (includes similarity)
  toSearchResult(): {
    id: string;
    indexId: string;
    sourceId: string;
    sourceType: SourceType;
    sourceName: string;
    title: string;
    content: string;
    metadata: DocumentMetadata;
    similarity?: number;
  } {
    return {
      id: this._id.value,
      indexId: this._indexId.value,
      sourceId: this._sourceId,
      sourceType: this._sourceType,
      sourceName: this._sourceName,
      title: this._title,
      content: this._content,
      metadata: { ...this._metadata },
      similarity: this._similarity
    };
  }
}