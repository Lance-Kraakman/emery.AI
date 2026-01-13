/**
 * Delegation Domain Registration Module
 *
 * Registers services for credential delegation domain:
 * - Delegation repository (Drizzle/PostgreSQL)
 * - Delegation application service
 *
 * Critical security component for OAuth credential delegation control.
 */

import type { DbClient } from '@/ddd/infrastructure/db/client';
import type { IDelegationRepository } from '@/ddd/domain/delegations/repositories/delegation-repository';
import { DrizzleDelegationRepository } from '@/ddd/infrastructure/db/repositories/delegations/drizzle-delegation-repository';
import { CredentialDelegationApplicationService } from '@/ddd/application/services/delegations/credential-delegation-application-service';

export interface DelegationServices {
  delegationRepository: IDelegationRepository;
  delegationApplicationService: CredentialDelegationApplicationService;
}

export interface DelegationDependencies {
  db: DbClient;
}

export function registerDelegationServices(deps: DelegationDependencies): DelegationServices {
  const { db } = deps;

  // Register delegation repository
  const delegationRepository = new DrizzleDelegationRepository(db);

  // Register delegation application service
  const delegationApplicationService = new CredentialDelegationApplicationService(
    delegationRepository
  );

  console.log('✅ Delegation services registered');

  return {
    delegationRepository,
    delegationApplicationService
  };
}
