/**
 * Billing Domain Registration Module
 *
 * Registers repositories and services for billing domain:
 * - Token Usage tracking
 * - Credit Usage management
 * - Invoice management
 * - Storage Quota management
 * - Storage Recalculation
 */

import type { ContextAwareDbClient } from '@/ddd/infrastructure/db/simple-context-proxy';
import type { ITokenUsageRepository } from '@/ddd/domain/billing/repositories/token-usage-repository';
import type { IInvoiceRepository } from '@/ddd/domain/billing/repositories/invoice-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IFileStorageRepository } from '@/ddd/domain/tables/repositories/file-storage-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import { DrizzleTokenUsageRepository } from '@/ddd/infrastructure/db/repositories/billing/drizzle-token-usage-repository';
import { DrizzleInvoiceRepository } from '@/ddd/infrastructure/db/repositories/billing/drizzle-invoice-repository';
import { S3FileStorageRepository } from '@/ddd/infrastructure/storage/repositories/s3-file-storage-repository';
import { TokenUsageApplicationService } from '@/ddd/application/services/billing/token-usage-application-service';
import { CreditUsageApplicationService } from '@/ddd/application/services/billing/credit-usage-application-service';
import { InvoiceApplicationService } from '@/ddd/application/services/billing/invoice-application-service';
import { StorageQuotaApplicationService } from '@/ddd/application/services/billing/storage-quota-application-service';
import { StorageRecalculationApplicationService } from '@/ddd/application/services/billing/storage-recalculation-application-service';

export interface BillingServices {
  tokenUsageRepository: ITokenUsageRepository;
  invoiceRepository: IInvoiceRepository;
  tokenUsageApplicationService: TokenUsageApplicationService;
  creditUsageApplicationService: CreditUsageApplicationService;
  invoiceApplicationService: InvoiceApplicationService;
  storageQuotaApplicationService: StorageQuotaApplicationService;
  storageRecalculationApplicationService: StorageRecalculationApplicationService;
}

export interface BillingDependencies {
  db: ContextAwareDbClient;
  organizationRepository: IOrganizationRepository;
  fileStorageRepository: IFileStorageRepository;
  agentRepository?: IAgentRepository;
}

export function registerBillingServices(deps: BillingDependencies): BillingServices {
  const { db, organizationRepository, fileStorageRepository, agentRepository } = deps;

  // Create a workspace-aware storage repository for recalculation service.
  // This uses agent + org repos to attribute workspace archives to organizations.
  const recalculationStorageRepo: IFileStorageRepository = agentRepository
    ? new S3FileStorageRepository(undefined, agentRepository, organizationRepository)
    : fileStorageRepository;

  // Register repositories
  const tokenUsageRepository = new DrizzleTokenUsageRepository(db);
  const invoiceRepository = new DrizzleInvoiceRepository(db);

  // Register application services
  const tokenUsageApplicationService = new TokenUsageApplicationService(
    tokenUsageRepository,
    organizationRepository
  );
  const creditUsageApplicationService = new CreditUsageApplicationService(tokenUsageRepository);
  const invoiceApplicationService = new InvoiceApplicationService(
    invoiceRepository,
    organizationRepository
  );
  const storageQuotaApplicationService = new StorageQuotaApplicationService(
    organizationRepository
  );
  const storageRecalculationApplicationService = new StorageRecalculationApplicationService(
    recalculationStorageRepo,
    organizationRepository
  );

  return {
    tokenUsageRepository,
    invoiceRepository,
    tokenUsageApplicationService,
    creditUsageApplicationService,
    invoiceApplicationService,
    storageQuotaApplicationService,
    storageRecalculationApplicationService,
  };
}
