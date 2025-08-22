// AIDEV-NOTE: Dependency injection container for RAG system
// Provides configured instances with proper dependency wiring

import { db, rawClient } from '@/lib/db/client';

// Infrastructure
import { 
  DrizzleRagIndexRepository,
  DrizzleRagDocumentRepository,
  HuggingFaceEmbeddingService,
  LlamaIndexContentProcessor,
  DrizzleSearchLoggerService,
  DataSourceAdapter
} from '@/lib/infrastructure/rag';

// Domain Services  
import { IndexingDomainService, SearchDomainService } from '@/lib/domain/rag/services';

// Application Services
import { 
  RagIndexingApplicationService, 
  RagSearchApplicationService 
} from '@/lib/application/rag/services';

/**
 * RAG Dependency Injection Container
 * Provides pre-configured service instances with proper dependencies
 */
export class RagDIContainer {
  // Infrastructure repositories
  private static _indexRepository: DrizzleRagIndexRepository;
  private static _documentRepository: DrizzleRagDocumentRepository;
  
  // Infrastructure services
  private static _embeddingService: HuggingFaceEmbeddingService;
  private static _contentProcessor: LlamaIndexContentProcessor;
  private static _searchLogger: DrizzleSearchLoggerService;
  private static _dataSourceAdapter: DataSourceAdapter;
  
  // Domain services
  private static _indexingDomainService: IndexingDomainService;
  private static _searchDomainService: SearchDomainService;
  
  // Application services
  private static _indexingApplicationService: RagIndexingApplicationService;
  private static _searchApplicationService: RagSearchApplicationService;

  /**
   * Get configured RAG index repository
   */
  static getIndexRepository(): DrizzleRagIndexRepository {
    if (!this._indexRepository) {
      this._indexRepository = new DrizzleRagIndexRepository(db);
    }
    return this._indexRepository;
  }

  /**
   * Get configured RAG document repository
   */
  static getDocumentRepository(): DrizzleRagDocumentRepository {
    if (!this._documentRepository) {
      this._documentRepository = new DrizzleRagDocumentRepository(db, rawClient);
    }
    return this._documentRepository;
  }

  /**
   * Get configured embedding service
   */
  static getEmbeddingService(): HuggingFaceEmbeddingService {
    if (!this._embeddingService) {
      this._embeddingService = new HuggingFaceEmbeddingService();
    }
    return this._embeddingService;
  }

  /**
   * Get configured content processor
   */
  static getContentProcessor(): LlamaIndexContentProcessor {
    if (!this._contentProcessor) {
      this._contentProcessor = new LlamaIndexContentProcessor(
        this.getEmbeddingService()
      );
    }
    return this._contentProcessor;
  }

  /**
   * Get configured search logger
   */
  static getSearchLogger(): DrizzleSearchLoggerService {
    if (!this._searchLogger) {
      this._searchLogger = new DrizzleSearchLoggerService();
    }
    return this._searchLogger;
  }

  /**
   * Get configured data source adapter
   */
  static getDataSourceAdapter(): DataSourceAdapter {
    if (!this._dataSourceAdapter) {
      this._dataSourceAdapter = new DataSourceAdapter();
    }
    return this._dataSourceAdapter;
  }

  /**
   * Get configured indexing domain service
   */
  static getIndexingDomainService(): IndexingDomainService {
    if (!this._indexingDomainService) {
      this._indexingDomainService = new IndexingDomainService(
        this.getContentProcessor()
      );
    }
    return this._indexingDomainService;
  }

  /**
   * Get configured search domain service
   */
  static getSearchDomainService(): SearchDomainService {
    if (!this._searchDomainService) {
      this._searchDomainService = new SearchDomainService(
        this.getEmbeddingService(),
        this.getSearchLogger()
      );
    }
    return this._searchDomainService;
  }

  /**
   * Get configured indexing application service
   */
  static getIndexingApplicationService(): RagIndexingApplicationService {
    if (!this._indexingApplicationService) {
      this._indexingApplicationService = new RagIndexingApplicationService(
        this.getIndexRepository(),
        this.getDocumentRepository(),
        this.getIndexingDomainService(),
        this.getDataSourceAdapter()
        // Note: EventPublisher not implemented yet
      );
    }
    return this._indexingApplicationService;
  }

  /**
   * Get configured search application service
   */
  static getSearchApplicationService(): RagSearchApplicationService {
    if (!this._searchApplicationService) {
      this._searchApplicationService = new RagSearchApplicationService(
        this.getIndexRepository(),
        this.getDocumentRepository(),
        this.getSearchDomainService(),
        this.getEmbeddingService(),
        this.getSearchLogger()
      );
    }
    return this._searchApplicationService;
  }

  /**
   * Reset all cached instances (useful for testing)
   */
  static reset(): void {
    this._indexRepository = undefined as any;
    this._documentRepository = undefined as any;
    this._embeddingService = undefined as any;
    this._contentProcessor = undefined as any;
    this._searchLogger = undefined as any;
    this._dataSourceAdapter = undefined as any;
    this._indexingDomainService = undefined as any;
    this._searchDomainService = undefined as any;
    this._indexingApplicationService = undefined as any;
    this._searchApplicationService = undefined as any;
  }

  /**
   * Get health status of all services
   */
  static async getHealthStatus(): Promise<{
    database: boolean;
    embedding: boolean;
    contentProcessor: boolean;
    searchLogger: boolean;
  }> {
    try {
      // Test database connection
      const indexRepo = this.getIndexRepository();
      await indexRepo.countByOrganization({ value: 1 } as any);
      
      // Test embedding service
      const embeddingService = this.getEmbeddingService();
      await embeddingService.generateEmbedding('test');
      
      return {
        database: true,
        embedding: true,
        contentProcessor: true,
        searchLogger: true
      };
    } catch (error) {
      console.error('[RAG-DI-CONTAINER] Health check failed:', error);
      return {
        database: false,
        embedding: false,
        contentProcessor: false,
        searchLogger: false
      };
    }
  }
}