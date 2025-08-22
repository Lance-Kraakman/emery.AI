// AIDEV-NOTE: Dependency injection container for RAG system
// Provides configured instances with proper dependency wiring

import { db, rawClient } from '@/lib/db/client';

// Infrastructure - Repositories and external integrations
import { 
  DrizzleRagIndexRepository,
  DrizzleRagDocumentRepository,
  DrizzleRagQueryLogRepository
} from '@/ddd/infrastructure/db/repositories/rag';
import { OrganizationDataServiceFactory } from '@/ddd/infrastructure/services/organization-data-service-impl';
import { LlamaIndexContentProcessor } from '@/ddd/infrastructure/external/llamaindex-file-processor';

// Application Services
import { 
  EmbeddingService,
  SearchAnalyticsService
} from '@/ddd/application/rag/services';

// Domain Services  
import { IndexingDomainService, SearchDomainService, type IOrganizationDataService } from '@/ddd/domain/rag/services';

// Application Services
import { 
  RagIndexingApplicationService, 
  RagSearchApplicationService 
} from '@/ddd/application/rag/services';

/**
 * RAG Dependency Injection Container
 * Provides pre-configured service instances with proper dependencies
 */
export class RagDIContainer {
  // Infrastructure repositories
  private static _indexRepository: DrizzleRagIndexRepository;
  private static _documentRepository: DrizzleRagDocumentRepository;
  private static _queryLogRepository: DrizzleRagQueryLogRepository;
  private static _organizationDataService: IOrganizationDataService;
  
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
      this._documentRepository = new DrizzleRagDocumentRepository(db);
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
   * Get configured organization data service
   */
  static getOrganizationDataService(): IOrganizationDataService {
    if (!this._organizationDataService) {
      this._organizationDataService = OrganizationDataServiceFactory.create(db, rawClient);
    }
    return this._organizationDataService;
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
        this.getOrganizationDataService()
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
    this._organizationDataService = undefined as any;
    this._embeddingService = undefined as any;
    this._contentProcessor = undefined as any;
    this._searchAnalyticsService = undefined as any;
    this._indexingDomainService = undefined as any;
    this._searchDomainService = undefined as any;
    this._indexingApplicationService = undefined as any;
    this._searchApplicationService = undefined as any;
  }
}