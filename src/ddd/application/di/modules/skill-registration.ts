/**
 * Skill Domain Registration Module
 *
 * AIDEV-NOTE: Simplified - removed step repository
 *
 * Registers repositories and services for skill domain:
 * - Skill repository
 * - Skill application service
 * - Skill enrichment service (for unified skill loading across execution paths)
 */

import type { ContextAwareDbClient } from '@/ddd/infrastructure/db/simple-context-proxy';
import type { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';

import { DrizzleSkillRepository } from '@/ddd/infrastructure/db/repositories/skills/drizzle-skill-repository';

import { SkillApplicationService } from '@/ddd/application/services/skills/skill-application-service';
import { SkillEnrichmentService } from '@/ddd/application/services/skills/skill-enrichment-service';

export interface SkillServices {
  skillRepository: ISkillRepository;
  skillApplicationService: SkillApplicationService;
  skillEnrichmentService: SkillEnrichmentService;
}

export interface SkillDependencies {
  db: ContextAwareDbClient;
}

export function registerSkillServices(deps: SkillDependencies): SkillServices {
  const { db } = deps;

  // Register skill repository (no longer depends on step repository)
  const skillRepository = new DrizzleSkillRepository(db);

  // Register application service
  const skillApplicationService = new SkillApplicationService(
    skillRepository
  );

  // Register enrichment service (for unified skill loading)
  const skillEnrichmentService = new SkillEnrichmentService(
    skillRepository
  );

  return {
    skillRepository,
    skillApplicationService,
    skillEnrichmentService
  };
}
