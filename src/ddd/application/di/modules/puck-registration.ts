/**
 * Puck Domain Registration Module
 *
 * Registers repositories and services for Puck domain:
 * - Puck app repository
 * - Puck page repository
 * - Puck app application service
 * - Puck page application service
 */

import type { ContextAwareDbClient } from '@/lib/db/simple-context-proxy';
import type { IPuckAppRepository } from '@/ddd/domain/puck/repositories/puck-app-repository';
import type { IPuckPageRepository } from '@/ddd/domain/puck/repositories/puck-page-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';

import { DrizzlePuckAppRepository } from '@/ddd/infrastructure/db/repositories/puck/drizzle-puck-app-repository';
import { DrizzlePuckPageRepository } from '@/ddd/infrastructure/db/repositories/puck/drizzle-puck-page-repository';

import { PuckAppApplicationService } from '@/ddd/application/services/puck/puck-app-application-service';
import { PuckPageApplicationService } from '@/ddd/application/services/puck/puck-page-application-service';

export interface PuckServices {
  puckAppRepository: IPuckAppRepository;
  puckPageRepository: IPuckPageRepository;
  puckAppApplicationService: PuckAppApplicationService;
  puckPageApplicationService: PuckPageApplicationService;
}

export interface PuckDependencies {
  db: ContextAwareDbClient;
  organizationRepository: IOrganizationRepository;
}

export function registerPuckServices(deps: PuckDependencies): PuckServices {
  const { db, organizationRepository } = deps;

  // Register repositories
  const puckAppRepository = new DrizzlePuckAppRepository(db);
  const puckPageRepository = new DrizzlePuckPageRepository(db);

  // Create application services
  const puckAppApplicationService = new PuckAppApplicationService(
    puckAppRepository,
    puckPageRepository,
    organizationRepository
  );

  const puckPageApplicationService = new PuckPageApplicationService(
    puckPageRepository,
    puckAppRepository
  );

  return {
    puckAppRepository,
    puckPageRepository,
    puckAppApplicationService,
    puckPageApplicationService
  };
}
