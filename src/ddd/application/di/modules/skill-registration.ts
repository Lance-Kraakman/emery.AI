/**
 * Skill Domain Registration Module
 *
 * Registers repositories and services for skill domain:
 * - Skill repository
 * - Step repository
 * - Skill application service
 */

import type { ContextAwareDbClient } from '@/lib/db/simple-context-proxy';
import type { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import type { IStepRepository } from '@/ddd/domain/skills/repositories/step-repository';

import { DrizzleSkillRepository } from '@/ddd/infrastructure/db/repositories/skills/drizzle-skill-repository';
import { DrizzleStepRepository } from '@/ddd/infrastructure/db/repositories/skills/drizzle-step-repository';

import { SkillApplicationService } from '@/ddd/application/services/skills/skill-application-service';

export interface SkillServices {
  stepRepository: IStepRepository;
  skillRepository: ISkillRepository;
  skillApplicationService: SkillApplicationService;
}

export interface SkillDependencies {
  db: ContextAwareDbClient;
}

export function registerSkillServices(deps: SkillDependencies): SkillServices {
  const { db } = deps;

  // Register repositories - step repository first (capability repository depends on it)
  const stepRepository = new DrizzleStepRepository(db);
  const skillRepository = new DrizzleSkillRepository(db, stepRepository);

  // Register application service
  const skillApplicationService = new SkillApplicationService(
    skillRepository,
    stepRepository
  );

  return {
    stepRepository,
    skillRepository,
    skillApplicationService
  };
}
