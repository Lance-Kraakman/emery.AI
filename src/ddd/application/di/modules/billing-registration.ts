/**
 * Billing Domain Registration Module
 *
 * Registers repositories and services for billing domain:
 * - Token Usage tracking
 */

import type { ContextAwareDbClient } from '@/lib/db/simple-context-proxy';
import type { ITokenUsageRepository } from '@/ddd/domain/billing/repositories/token-usage-repository';
import { DrizzleTokenUsageRepository } from '@/ddd/infrastructure/db/repositories/billing/drizzle-token-usage-repository';

export interface BillingServices {
  tokenUsageRepository: ITokenUsageRepository;
}

export interface BillingDependencies {
  db: ContextAwareDbClient;
}

export function registerBillingServices(deps: BillingDependencies): BillingServices {
  const { db } = deps;

  // Register repositories
  const tokenUsageRepository = new DrizzleTokenUsageRepository(db);

  return {
    tokenUsageRepository
  };
}
