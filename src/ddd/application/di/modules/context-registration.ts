/**
 * Context Domain Registration Module
 *
 * Registers repositories and services for context sync domain:
 * - Context mapping repository
 * - Context mapping application service
 * - System tables bootstrap service (future)
 */

import type { ContextAwareDbClient } from '@/ddd/infrastructure/db/simple-context-proxy';
import type { IContextMappingRepository } from '@/ddd/domain/context/repositories/context-mapping-repository';
import { DrizzleContextMappingRepository } from '@/ddd/infrastructure/db/repositories/context/drizzle-context-mapping-repository';
import { ContextMappingApplicationService } from '@/ddd/application/services/context/context-mapping-application-service';

export interface ContextServices {
  contextMappingRepository: IContextMappingRepository;
  contextMappingApplicationService: ContextMappingApplicationService;
}

export interface ContextDependencies {
  db: ContextAwareDbClient;
}

export function registerContextServices(deps: ContextDependencies): ContextServices {
  const { db } = deps;

  // Register repository
  const contextMappingRepository = new DrizzleContextMappingRepository(db);

  // Register application service
  const contextMappingApplicationService = new ContextMappingApplicationService(
    contextMappingRepository
  );

  return {
    contextMappingRepository,
    contextMappingApplicationService,
  };
}
