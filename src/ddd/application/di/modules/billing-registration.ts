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

import type { ContextAwareDbClient } from '@/lib/db/simple-context-proxy';
import type { ITokenUsageRepository } from '@/ddd/domain/billing/repositories/token-usage-repository';
import type { IInvoiceRepository } from '@/ddd/domain/billing/repositories/invoice-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IFileStorageRepository } from '@/ddd/domain/tables/repositories/file-storage-repository';
import { DrizzleTokenUsageRepository } from '@/ddd/infrastructure/db/repositories/billing/drizzle-token-usage-repository';
import { DrizzleInvoiceRepository } from '@/ddd/infrastructure/db/repositories/billing/drizzle-invoice-repository';
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
}

export function registerBillingServices(deps: BillingDependencies): BillingServices {
  const { db, organizationRepository, fileStorageRepository } = deps;

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
    fileStorageRepository,
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
