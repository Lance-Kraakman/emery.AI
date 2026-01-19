/**
 * Security Domain Registration Module
 */

import type { DbClient } from '@/ddd/infrastructure/db/client';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import type {
  ISecurityReportRepository,
  ISecurityFindingRepository,
} from '@/ddd/domain/security/interfaces/security-repository';
import { DrizzleSecurityReportRepository } from '@/ddd/infrastructure/db/repositories/security/drizzle-security-report-repository';
import { DrizzleSecurityFindingRepository } from '@/ddd/infrastructure/db/repositories/security/drizzle-security-finding-repository';
import { RuleEngineService } from '@/ddd/application/services/security/rule-engine.service';
import { SecurityAnalyzerService } from '@/ddd/application/services/security/security-analyzer.service';

export interface SecurityServices {
  securityReportRepository: ISecurityReportRepository;
  securityFindingRepository: ISecurityFindingRepository;
  ruleEngineService: RuleEngineService;
  securityAnalyzerService: SecurityAnalyzerService;
}

export interface SecurityDependencies {
  db: DbClient;
  agentRepository: IAgentRepository;
  skillRepository: ISkillRepository;
}

export function registerSecurityServices(deps: SecurityDependencies): SecurityServices {
  const { db, agentRepository, skillRepository } = deps;

  const securityReportRepository = new DrizzleSecurityReportRepository(db);
  const securityFindingRepository = new DrizzleSecurityFindingRepository(db);
  const ruleEngineService = new RuleEngineService();

  const securityAnalyzerService = new SecurityAnalyzerService(
    agentRepository,
    skillRepository,
    securityReportRepository,
    securityFindingRepository,
    ruleEngineService
  );

  console.log('✅ Security services registered');

  return {
    securityReportRepository,
    securityFindingRepository,
    ruleEngineService,
    securityAnalyzerService,
  };
}
