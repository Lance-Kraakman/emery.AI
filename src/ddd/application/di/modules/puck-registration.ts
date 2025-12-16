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
import type { IAppRepository } from '@/ddd/domain/puck/repositories/app-repository';
import type { IPuckPageRepository } from '@/ddd/domain/puck/repositories/puck-page-repository';
import type { ITemplateRepository } from '@/ddd/domain/puck/repositories/template-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';

import { DrizzleAppRepository } from '@/ddd/infrastructure/db/repositories/puck/drizzle-app-repository';
import { DrizzlePuckPageRepository } from '@/ddd/infrastructure/db/repositories/puck/drizzle-puck-page-repository';
import { DrizzleTemplateRepository } from '@/ddd/infrastructure/db/repositories/puck/drizzle-template-repository';

import { AppApplicationService } from '@/ddd/application/services/puck/app-application-service';
import { PuckPageApplicationService } from '@/ddd/application/services/puck/puck-page-application-service';
import { TemplateApplicationService } from '@/ddd/application/services/puck/template-application-service';

export interface PuckServices {
  puckAppRepository: IAppRepository;
  puckPageRepository: IPuckPageRepository;
  puckAppApplicationService: AppApplicationService;
  puckPageApplicationService: PuckPageApplicationService;
  templateRepository: ITemplateRepository;
  templateApplicationService: TemplateApplicationService;
}

export interface PuckDependencies {
  db: ContextAwareDbClient;
  organizationRepository: IOrganizationRepository;
}

export function registerPuckServices(deps: PuckDependencies): PuckServices {
  const { db, organizationRepository } = deps;

  // Register repositories
  const puckAppRepository = new DrizzleAppRepository(db);
  const puckPageRepository = new DrizzlePuckPageRepository(db);
  const templateRepository = new DrizzleTemplateRepository(db);

  // Create application services
  const puckAppApplicationService = new AppApplicationService(
    puckAppRepository,
    puckPageRepository,
    organizationRepository
  );

  const puckPageApplicationService = new PuckPageApplicationService(
    puckPageRepository,
    puckAppRepository
  );

  const templateApplicationService = new TemplateApplicationService(
    templateRepository,
    organizationRepository
  );

  return {
    puckAppRepository,
    puckPageRepository,
    puckAppApplicationService,
    puckPageApplicationService,
    templateRepository,
    templateApplicationService
  };
}
