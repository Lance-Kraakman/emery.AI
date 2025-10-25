/**
 * Capability Domain Registration Module
 *
 * Registers repositories and services for capability domain:
 * - Capability repository
 * - Step repository
 * - Capability application service
 */

import type { ContextAwareDbClient } from '@/lib/db/simple-context-proxy';
import type { ICapabilityRepository } from '@/ddd/domain/capabilities/repositories/capability-repository';
import type { IStepRepository } from '@/ddd/domain/capabilities/repositories/step-repository';

import { DrizzleCapabilityRepository } from '@/ddd/infrastructure/db/repositories/capabilities/drizzle-capability-repository';
import { DrizzleStepRepository } from '@/ddd/infrastructure/db/repositories/capabilities/drizzle-step-repository';

import { CapabilityApplicationService } from '@/ddd/application/services/capabilities/capability-application-service';

export interface CapabilityServices {
  stepRepository: IStepRepository;
  capabilityRepository: ICapabilityRepository;
  capabilityApplicationService: CapabilityApplicationService;
}

export interface CapabilityDependencies {
  db: ContextAwareDbClient;
}

export function registerCapabilityServices(deps: CapabilityDependencies): CapabilityServices {
  const { db } = deps;

  // Register repositories - step repository first (capability repository depends on it)
  const stepRepository = new DrizzleStepRepository(db);
  const capabilityRepository = new DrizzleCapabilityRepository(db, stepRepository);

  // Register application service
  const capabilityApplicationService = new CapabilityApplicationService(
    capabilityRepository,
    stepRepository
  );

  return {
    stepRepository,
    capabilityRepository,
    capabilityApplicationService
  };
}
