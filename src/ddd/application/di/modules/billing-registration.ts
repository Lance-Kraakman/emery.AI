/**
 * Billing Domain Registration Module
 *
 * Registers repositories and services for billing domain:
 * - Token Usage tracking
 * - Credit Usage management
 */

import type { ContextAwareDbClient } from '@/lib/db/simple-context-proxy';
import type { ITokenUsageRepository } from '@/ddd/domain/billing/repositories/token-usage-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { DrizzleTokenUsageRepository } from '@/ddd/infrastructure/db/repositories/billing/drizzle-token-usage-repository';
import { TokenUsageApplicationService } from '@/ddd/application/services/billing/token-usage-application-service';
import { CreditUsageApplicationService } from '@/ddd/application/services/billing/credit-usage-application-service';

export interface BillingServices {
  tokenUsageRepository: ITokenUsageRepository;
  tokenUsageApplicationService: TokenUsageApplicationService;
  creditUsageApplicationService: CreditUsageApplicationService;
}

export interface BillingDependencies {
  db: ContextAwareDbClient;
  organizationRepository: IOrganizationRepository;
}

export function registerBillingServices(deps: BillingDependencies): BillingServices {
  const { db, organizationRepository } = deps;

  // Register repositories
  const tokenUsageRepository = new DrizzleTokenUsageRepository(db);

  // Register application services
  const tokenUsageApplicationService = new TokenUsageApplicationService(
    tokenUsageRepository,
    organizationRepository
  );
  const creditUsageApplicationService = new CreditUsageApplicationService(tokenUsageRepository);

  return {
    tokenUsageRepository,
    tokenUsageApplicationService,
    creditUsageApplicationService,
  };
}
