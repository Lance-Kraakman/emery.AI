import type { Reference } from '@/ddd/domain/chat/value-objects/reference';
import type { ReferenceCategory } from '@/ddd/domain/chat/value-objects/reference-types';

/**
 * Reference Data Transfer Object for Frontend
 *
 * Represents references in a format optimized for UI consumption.
 * Includes additional metadata for rendering and interaction.
 */
export interface ReferenceDTO {
  /** Unique reference identifier */
  id: string;
  /** Insert text for chat (@doc:path, @file:path, etc.) */
  insertText: string;
  /** Display name for UI */
  displayName: string;
  /** Description for tooltips/search */
  description: string;
  /** Reference category for grouping and icons */
  category: ReferenceCategory;
  /** Reference path (part after colon in insertText) */
  referencePath: string;
  /** Reference prefix (@doc, @file, etc.) */
  referencePrefix: string;
  /** Whether reference can be opened as artifact */
  canOpenArtifact: boolean;
  /** Metadata for enhanced UI display */
  metadata?: ReferenceMetadataDTO;
}

/**
 * Reference metadata for enhanced UI display
 */
export interface ReferenceMetadataDTO {
  /** Title for display (can differ from displayName) */
  title?: string;
  /** File type or document type */
  type?: string;
  /** File size in bytes */
  size?: number;
  /** MIME type */
  mimeType?: string;
  /** Word count for documents */
  wordCount?: number;
  /** Last modified date */
  lastModified?: string;
  /** File URL for viewing */
  fileUrl?: string;
  /** Table name for table-based references */
  tableName?: string;
  /** Database name */
  databaseName?: string;
  /** Agent role for agent references */
  agentRole?: string;
  /** Whether reference has errors */
  error?: string;
}

/**
 * Reference search result DTO
 */
export interface ReferenceSearchResultDTO {
  /** Found references */
  references: ReferenceDTO[];
  /** Whether more results available */
  hasMore: boolean;
  /** Total count of results */
  totalCount: number;
  /** Search query used */
  query?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string;
}

/**
 * Reference category grouping for UI
 */
export interface ReferenceCategoryDTO {
  /** Category name */
  name: ReferenceCategory;
  /** Display label */
  label: string;
  /** Icon identifier */
  icon: string;
  /** Category description */
  description: string;
  /** References in this category */
  references: ReferenceDTO[];
  /** Category color for UI theming */
  color?: string;
}

/**
 * Reference panel state DTO
 */
export interface ReferencePanelStateDTO {
  /** Currently resolved references */
  resolvedReferences: ReferenceDTO[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error?: string;
  /** Whether panel is collapsed */
  isCollapsed: boolean;
}

/**
 * Reference Mapper - converts between domain objects and DTOs
 */
export class ReferenceMapper {
  /**
   * Convert domain Reference to frontend ReferenceDTO
   */
  static toDTO(reference: Reference, metadata?: Partial<ReferenceMetadataDTO>): ReferenceDTO {
    return {
      id: reference.id,
      insertText: reference.insertText,
      displayName: reference.displayName,
      description: reference.description,
      category: reference.category,
      referencePath: reference.referencePath,
      referencePrefix: reference.referencePrefix,
      canOpenArtifact: this.canOpenArtifact(reference),
      metadata: metadata ? this.enhanceMetadata(metadata, reference) : undefined
    };
  }

  /**
   * Convert array of domain References to DTOs
   */
  static toDTOArray(references: Reference[], metadata?: Record<string, Partial<ReferenceMetadataDTO>>): ReferenceDTO[] {
    return references.map(reference => {
      const referenceMetadata = metadata?.[reference.id];
      return this.toDTO(reference, referenceMetadata);
    });
  }

  /**
   * Convert DTO back to domain Reference (for operations)
   */
  static toDomain(dto: ReferenceDTO): Reference {
    return new Reference(
      dto.id,
      dto.insertText,
      dto.displayName,
      dto.description,
      dto.category
    );
  }

  /**
   * Create reference category DTOs for UI organization
   */
  static createCategoryDTOs(references: ReferenceDTO[]): ReferenceCategoryDTO[] {
    const categories: Record<ReferenceCategory, ReferenceDTO[]> = {
      doc: [],
      file: [],
      agent: [],
      table: [],
      database: []
    };

    // Group references by category
    references.forEach(reference => {
      categories[reference.category].push(reference);
    });

    // Convert to category DTOs
    return Object.entries(categories)
      .filter(([, refs]) => refs.length > 0)
      .map(([categoryName, categoryRefs]) => ({
        name: categoryName as ReferenceCategory,
        label: this.getCategoryLabel(categoryName as ReferenceCategory),
        icon: this.getCategoryIcon(categoryName as ReferenceCategory),
        description: this.getCategoryDescription(categoryName as ReferenceCategory),
        references: categoryRefs,
        color: this.getCategoryColor(categoryName as ReferenceCategory)
      }));
  }

  /**
   * Create legacy ResolvedReference for backward compatibility
   */
  static toLegacyResolvedReference(dto: ReferenceDTO): {
    type: 'doc' | 'file' | 'table' | 'agent';
    fullPath: string;
    originalMatch: string;
    startIndex: number;
    endIndex: number;
    data?: any;
    metadata?: {
      title?: string;
      description?: string;
      content?: string;
      size?: number;
      mimeType?: string;
      wordCount?: number;
      error?: string;
    };
  } {
    return {
      type: dto.category as 'doc' | 'file' | 'table' | 'agent',
      fullPath: dto.referencePath,
      originalMatch: dto.insertText,
      startIndex: 0,
      endIndex: dto.insertText.length,
      data: {
        id: dto.id,
        name: dto.displayName,
        documentMetadata: dto.metadata?.type === 'document' ? {
          title: dto.metadata.title || dto.displayName
        } : undefined
      },
      metadata: {
        title: dto.metadata?.title,
        description: dto.description,
        size: dto.metadata?.size,
        mimeType: dto.metadata?.mimeType,
        wordCount: dto.metadata?.wordCount,
        error: dto.metadata?.error
      }
    };
  }

  /**
   * Check if reference can be opened as artifact
   */
  private static canOpenArtifact(reference: Reference): boolean {
    return reference.category === 'doc' || reference.category === 'file';
  }

  /**
   * Enhance metadata with additional derived information
   */
  private static enhanceMetadata(metadata: Partial<ReferenceMetadataDTO>, reference: Reference): ReferenceMetadataDTO {
    const enhanced: ReferenceMetadataDTO = { ...metadata };

    // Parse path for table/database info
    if (reference.category === 'doc' || reference.category === 'file') {
      const pathParts = reference.referencePath.split('/');
      if (pathParts.length >= 2) {
        enhanced.databaseName = pathParts[0];
        enhanced.tableName = pathParts[1];
      }
    }

    // Set type based on category
    if (!enhanced.type) {
      enhanced.type = reference.category;
    }

    return enhanced;
  }

  /**
   * Get category label for display
   */
  private static getCategoryLabel(category: ReferenceCategory): string {
    const labels: Record<ReferenceCategory, string> = {
      doc: 'Documents',
      file: 'Files',
      agent: 'Agents',
      table: 'Tables',
      database: 'Databases'
    };
    return labels[category];
  }

  /**
   * Get category icon identifier
   */
  private static getCategoryIcon(category: ReferenceCategory): string {
    const icons: Record<ReferenceCategory, string> = {
      doc: 'FileText',
      file: 'File',
      agent: 'Users',
      table: 'Database',
      database: 'Server'
    };
    return icons[category];
  }

  /**
   * Get category description
   */
  private static getCategoryDescription(category: ReferenceCategory): string {
    const descriptions: Record<ReferenceCategory, string> = {
      doc: 'Text documents and rich content',
      file: 'Files and attachments',
      agent: 'AI agents and assistants',
      table: 'Data tables and records',
      database: 'Database collections'
    };
    return descriptions[category];
  }

  /**
   * Get category color for UI theming
   */
  private static getCategoryColor(category: ReferenceCategory): string {
    const colors: Record<ReferenceCategory, string> = {
      doc: 'blue',
      file: 'green',
      agent: 'orange',
      table: 'purple',
      database: 'gray'
    };
    return colors[category];
  }
}

// Legacy interface for backward compatibility during migration
export interface ResolvedReference {
  type: 'doc' | 'file' | 'table' | 'agent';
  fullPath: string;
  originalMatch: string;
  startIndex: number;
  endIndex: number;
  data?: any;
  metadata?: {
    title?: string;
    description?: string;
    content?: string;
    size?: number;
    mimeType?: string;
    wordCount?: number;
    error?: string;
  };
}