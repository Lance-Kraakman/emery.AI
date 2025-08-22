// AIDEV-NOTE: Dependency injection container for RAG system
// Provides configured instances with proper dependency wiring

import { db, rawClient } from '@/lib/db/client';

// Infrastructure - Repositories and external integrations
import { 
  DrizzleRagIndexRepository,
  DrizzleRagDocumentRepository,
  DrizzleRagQueryLogRepository,
  DrizzleOrganizationDataRepository,
  LlamaIndexContentProcessor
} from '@/lib/infrastructure/rag';

// Application Services
import { 
  EmbeddingService,
  SearchAnalyticsService
} from '@/lib/application/rag/services';

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
  private static _queryLogRepository: DrizzleRagQueryLogRepository;
  private static _organizationDataRepository: DrizzleOrganizationDataRepository;
  
  // Application services
  private static _embeddingService: EmbeddingService;
  private static _contentProcessor: LlamaIndexContentProcessor;
  private static _searchAnalyticsService: SearchAnalyticsService;
  
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
  static getEmbeddingService(): EmbeddingService {
    if (!this._embeddingService) {
      this._embeddingService = new EmbeddingService();
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
   * Get configured query log repository
   */
  static getQueryLogRepository(): DrizzleRagQueryLogRepository {
    if (!this._queryLogRepository) {
      this._queryLogRepository = new DrizzleRagQueryLogRepository(db);
    }
    return this._queryLogRepository;
  }

  /**
   * Get configured organization data repository
   */
  static getOrganizationDataRepository(): DrizzleOrganizationDataRepository {
    if (!this._organizationDataRepository) {
      this._organizationDataRepository = new DrizzleOrganizationDataRepository(db, rawClient);
    }
    return this._organizationDataRepository;
  }

  /**
   * Get configured search analytics service
   */
  static getSearchAnalyticsService(): SearchAnalyticsService {
    if (!this._searchAnalyticsService) {
      this._searchAnalyticsService = new SearchAnalyticsService(
        this.getQueryLogRepository()
      );
    }
    return this._searchAnalyticsService;
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
        this.getSearchAnalyticsService()
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
        this.getOrganizationDataRepository()
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
        this.getSearchAnalyticsService()
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
    this._queryLogRepository = undefined as any;
    this._organizationDataRepository = undefined as any;
    this._embeddingService = undefined as any;
    this._contentProcessor = undefined as any;
    this._searchAnalyticsService = undefined as any;
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
    searchAnalytics: boolean;
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
        searchAnalytics: true
      };
    } catch (error) {
      console.error('[RAG-DI-CONTAINER] Health check failed:', error);
      return {
        database: false,
        embedding: false,
        contentProcessor: false,
        searchAnalytics: false
      };
    }
  }
}