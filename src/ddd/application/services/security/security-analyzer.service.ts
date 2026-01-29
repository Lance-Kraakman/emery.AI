/**
 * Security Analyzer Service
 *
 * Orchestrates security analysis for organizations.
 * Collects agents, skills, and automations, runs them through the rule engine,
 * and generates security reports with findings.
 */

import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import type {
  ISecurityReportRepository,
  ISecurityFindingRepository,
} from '@/ddd/domain/security/interfaces/security-repository';
import type { RuleEngineService } from './rule-engine.service';
import type {
  SecurityReport,
  SecurityReportData,
  RuleViolation,
} from '@/ddd/domain/security/types';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';

export class SecurityAnalyzerService {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly skillRepository: ISkillRepository,
    private readonly reportRepository: ISecurityReportRepository,
    private readonly findingRepository: ISecurityFindingRepository,
    private readonly ruleEngine: RuleEngineService
  ) {}

  /**
   * Analyze an organization's security posture
   */
  async analyzeOrganization(
    organizationId: number,
    createdBy: string
  ): Promise<Result<SecurityReport>> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);

      // Create report in 'generating' status
      const initialReportData = this.createInitialReportData();
      const report = await this.reportRepository.create({
        organizationId,
        createdBy,
        reportData: initialReportData,
      });

      // Load all entities
      const agents = await this.agentRepository.findByOrganization(orgId);
      const skills = await this.skillRepository.findByOrganizationId(orgId);

      // Convert to plain objects for rule engine
      const agentData = agents.map((a) => this.serializeAgent(a));
      const skillData = skills.map((s) => this.serializeSkill(s));

      // Run rule engine
      const violations = this.ruleEngine.evaluate({
        agents: agentData,
        skills: skillData,
      });

      // Create findings
      await this.findingRepository.createBulk(
        violations.map((v) => ({
          organizationId,
          reportId: report.id,
          riskLevel: v.riskLevel,
          findingData: v.findingData,
        }))
      );

      // Calculate summary and build final report
      const finalReportData = this.buildFinalReportData(
        agentData,
        skillData,
        violations
      );

      // Update report with final data
      await this.reportRepository.updateStatus(report.id, 'completed', new Date());
      await this.reportRepository.updateReportData(report.id, finalReportData);

      return {
        success: true,
        data: { ...report, reportData: finalReportData, status: 'completed' as const },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      };
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private createInitialReportData(): SecurityReportData {
    return {
      reportType: 'full',
      version: 1,
      overallScore: 0,
      riskGrade: 'A',
      findingCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      owaspViolations: { llm2025: [], agentic2026: [], web2025: [] },
      agentProfiles: [],
      authorizedAccess: { approvedPlans: [], delegations: [], apiTokens: [] },
      strengths: [],
      topRecommendations: [],
    };
  }

  private buildFinalReportData(
    agents: any[],
    skills: any[],
    violations: RuleViolation[]
  ): SecurityReportData {
    const findingCounts = this.calculateFindingCounts(violations);
    const overallScore = this.calculateRiskScore(findingCounts);
    const riskGrade = this.calculateGrade(overallScore);
    const owaspViolations = this.extractOwaspViolations(violations);
    const strengths = this.detectStrengths(agents, skills, violations);
    const authorizedAccess = this.collectAuthorizedAccess(agents, skills);
    const agentProfiles = this.buildAgentProfiles(agents, violations);
    const topRecommendations = this.generateRecommendations(violations);

    return {
      reportType: 'full',
      version: 1,
      overallScore,
      riskGrade,
      findingCounts,
      owaspViolations,
      agentProfiles,
      authorizedAccess,
      strengths,
      topRecommendations,
    };
  }

  private calculateFindingCounts(
    violations: RuleViolation[]
  ): SecurityReportData['findingCounts'] {
    return {
      critical: violations.filter((v) => v.riskLevel === 'critical').length,
      high: violations.filter((v) => v.riskLevel === 'high').length,
      medium: violations.filter((v) => v.riskLevel === 'medium').length,
      low: violations.filter((v) => v.riskLevel === 'low').length,
      info: violations.filter((v) => v.riskLevel === 'info').length,
    };
  }

  private calculateRiskScore(counts: SecurityReportData['findingCounts']): number {
    // Higher score = more secure (100 = perfect, 0 = critical issues)
    const penalties =
      counts.critical * 25 +
      counts.high * 15 +
      counts.medium * 5 +
      counts.low * 1;
    return Math.max(0, 100 - penalties);
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private extractOwaspViolations(
    violations: RuleViolation[]
  ): SecurityReportData['owaspViolations'] {
    const result = { llm2025: new Set<string>(), agentic2026: new Set<string>(), web2025: new Set<string>() };

    for (const v of violations) {
      for (const ref of v.findingData.owaspRefs) {
        if (ref.category === 'LLM_2025') {
          result.llm2025.add(ref.code);
        } else if (ref.category === 'AGENTIC_2026') {
          result.agentic2026.add(ref.code);
        } else if (ref.category === 'WEB_2025') {
          result.web2025.add(ref.code);
        }
      }
    }

    return {
      llm2025: Array.from(result.llm2025),
      agentic2026: Array.from(result.agentic2026),
      web2025: Array.from(result.web2025),
    };
  }

  private detectStrengths(
    agents: any[],
    skills: any[],
    violations: RuleViolation[]
  ): SecurityReportData['strengths'] {
    const strengths: SecurityReportData['strengths'] = [];

    // Check for approved plans
    const skillsWithApprovedPlans = skills.filter((s) =>
      s.steps?.some((step: any) => step.agenticConfig?.plan?.approvedAt)
    );
    if (skillsWithApprovedPlans.length > 0) {
      strengths.push({
        category: 'hitl',
        title: 'Approved execution plans',
        description: `${skillsWithApprovedPlans.length} skill(s) have approved autonomous execution plans`,
        resourceType: 'organization',
      });
    }

    // Check for low finding counts
    if (violations.filter((v) => v.riskLevel === 'critical').length === 0) {
      strengths.push({
        category: 'security',
        title: 'No critical vulnerabilities',
        description: 'No critical security issues were detected',
        resourceType: 'organization',
      });
    }

    // Check for agents with minimal tool exposure
    const agentsWithFocusedTools = agents.filter((a) => {
      const agentSkills = skills.filter((s) => s.agentId === a.id);
      const totalTools = agentSkills.reduce(
        (sum: number, s: any) => sum + (s.tools?.length || 0),
        0
      );
      return totalTools <= 5;
    });
    if (agentsWithFocusedTools.length > 0 && agents.length > 0) {
      strengths.push({
        category: 'least-privilege',
        title: 'Focused tool access',
        description: `${agentsWithFocusedTools.length} agent(s) have minimal tool exposure`,
        resourceType: 'organization',
      });
    }

    return strengths;
  }

  private collectAuthorizedAccess(
    agents: any[],
    skills: any[]
  ): SecurityReportData['authorizedAccess'] {
    return {
      approvedPlans: skills
        .filter((s) =>
          s.steps?.some((step: any) => step.agenticConfig?.plan?.approvedAt)
        )
        .map((s) => ({
          skillId: s.id,
          skillName: s.name,
          approvedAt:
            s.steps?.find((step: any) => step.agenticConfig?.plan?.approvedAt)
              ?.agenticConfig?.plan?.approvedAt || '',
          approvedBy: 'system',
        })),
      delegations: [], // Would need credential delegations repository
      apiTokens: agents
        .filter((a) => a.apiKey || a.webhookToken)
        .map((a) => ({
          agentId: a.id,
          agentName: a.name,
          hasApiKey: !!a.apiKey,
          hasWebhook: !!a.webhookToken,
        })),
    };
  }

  private buildAgentProfiles(
    agents: any[],
    violations: RuleViolation[]
  ): SecurityReportData['agentProfiles'] {
    return agents.map((agent) => {
      const agentViolations = violations.filter(
        (v) =>
          v.resourceType === 'agent' && v.resourceId === String(agent.id)
      );
      return {
        agentId: agent.id,
        agentName: agent.name,
        riskScore: 100 - agentViolations.length * 10,
        findingCount: agentViolations.length,
      };
    });
  }

  private generateRecommendations(violations: RuleViolation[]): string[] {
    const recommendations: string[] = [];
    const uniqueRuleIds = new Set(violations.map((v) => v.ruleId));

    if (uniqueRuleIds.has('prompt-injection-interpolation')) {
      recommendations.push(
        'Sanitize user inputs before including them in LLM prompts'
      );
    }
    if (uniqueRuleIds.has('excessive-tool-permissions')) {
      recommendations.push(
        'Apply least privilege principle - limit tools per skill'
      );
    }
    if (uniqueRuleIds.has('unapproved-automation-trigger')) {
      recommendations.push(
        'Review and approve execution plans for external triggers'
      );
    }
    if (uniqueRuleIds.has('dangerous-tool-combo')) {
      recommendations.push(
        'Separate file system and code execution into isolated skills'
      );
    }
    if (uniqueRuleIds.has('sensitive-data-instructions')) {
      recommendations.push(
        'Remove hardcoded secrets, use environment variables'
      );
    }

    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  // ============================================================================
  // SERIALIZATION
  // ============================================================================

  private serializeAgent(agent: any): any {
    return {
      id: agent.id?.value ?? agent.id,
      name: agent.name,
      automations: agent.automations || [],
      apiKey: agent.apiKey,
      webhookToken: agent.webhookToken,
    };
  }

  private serializeSkill(skill: any): any {
    return {
      id: skill.id?.value ?? skill.id,
      name: skill.name,
      agentId: skill.agentId?.value ?? skill.agentId,
      instructions: skill.instructions,
      tools: skill.tools || [],
      inputs: skill.inputs || [],
      steps: skill.steps || [],
    };
  }
}
