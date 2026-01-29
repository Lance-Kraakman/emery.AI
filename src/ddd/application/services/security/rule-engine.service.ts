/**
 * Security Rule Engine Service
 *
 * Evaluates security rules against agents, skills, and automations.
 * Based on OWASP LLM Top 10 (2025), Agentic AI Top 10 (2026), and Web Top 10 (2025).
 */

import type {
  RiskLevel,
  RuleViolation,
  OwaspReference,
  SecurityFindingData,
} from '@/ddd/domain/security/types';

// ============================================================================
// SERIALIZED ENTITY TYPES (for analysis)
// ============================================================================
//
// These types are simplified representations of domain entities for security analysis.
// We use custom serialized types instead of domain entities (Agent, Skill) because:
// 1. The rule engine only needs a subset of fields
// 2. Domain entities use Value Objects (AgentId, SkillId) requiring .value access
// 3. These types match the JSON structure passed from the analyzer service
// 4. Keeps rule check functions clean and readable

/**
 * Serialized skill representation for security analysis.
 * Matches the structure returned by skill repository serialization.
 */
export interface SerializedSkill {
  id: number;
  name: string;
  instructions?: string;
  tools?: Array<{
    name?: string;
    type?: string;
  }>;
  inputs?: Array<{
    name?: string;
    key?: string;
    type?: string;
    required?: boolean;
    validation?: unknown;
    format?: string;
  }>;
  steps?: Array<{
    type?: string;
    executionType?: string;
    agenticConfig?: {
      plan?: {
        approvedAt?: string;
      };
    };
  }>;
}

/**
 * Automation configuration within an agent.
 */
export interface SerializedAutomation {
  skillId: number;
  name?: string;
  enabled?: boolean;
  trigger?: {
    type?: 'WEBHOOK' | 'DATABASE_EVENT' | 'PIPEDREAM_EVENT' | 'SCHEDULE' | string;
  };
  inputMappings?: Record<string, unknown>;
}

/**
 * Serialized agent representation for security analysis.
 * Matches the structure returned by agent repository serialization.
 */
export interface SerializedAgent {
  id: number;
  name: string;
  automations?: SerializedAutomation[];
  apiKey?: string;
  webhookToken?: string;
}

// ============================================================================
// RULE ENGINE TYPES
// ============================================================================

export interface SecurityRule {
  id: string;
  name: string;
  riskLevel: RiskLevel;
  owaspRefs: OwaspReference[];
  targetType: 'agent' | 'skill' | 'automation' | 'delegation';
  check: (entity: unknown, context: RuleContext) => RuleViolation | null;
}

interface RuleContext {
  allAgents: SerializedAgent[];
  allSkills: SerializedSkill[];
  getSkillById: (id: number) => SerializedSkill | undefined;
}

export interface AnalysisInput {
  agents: SerializedAgent[];
  skills: SerializedSkill[];
}

// ============================================================================
// RULE ENGINE SERVICE
// ============================================================================

export class RuleEngineService {
  private rules: SecurityRule[] = [];

  constructor() {
    this.registerBuiltInRules();
  }

  /**
   * Evaluate all rules against the provided entities
   */
  evaluate(input: AnalysisInput): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const context: RuleContext = {
      allAgents: input.agents,
      allSkills: input.skills,
      getSkillById: (id) => input.skills.find((s) => s.id === id),
    };

    // Run skill rules
    for (const skill of input.skills) {
      for (const rule of this.rules.filter((r) => r.targetType === 'skill')) {
        const violation = rule.check(skill, context);
        if (violation) violations.push(violation);
      }
    }

    // Run agent rules
    for (const agent of input.agents) {
      for (const rule of this.rules.filter((r) => r.targetType === 'agent')) {
        const violation = rule.check(agent, context);
        if (violation) violations.push(violation);
      }

      // Run automation rules
      const automations = agent.automations || [];
      for (const automation of automations) {
        for (const rule of this.rules.filter((r) => r.targetType === 'automation')) {
          const violation = rule.check({ automation, agent }, context);
          if (violation) violations.push(violation);
        }
      }
    }

    return violations;
  }

  /**
   * Get all registered rules (for testing/introspection)
   */
  getRules(): SecurityRule[] {
    return [...this.rules];
  }

  // ============================================================================
  // BUILT-IN RULES
  // ============================================================================

  private registerBuiltInRules(): void {
    // PROMPT INJECTION RULES
    this.rules.push(this.createPromptInjectionInterpolationRule());
    this.rules.push(this.createPromptInjectionPatternsRule());
    this.rules.push(this.createDatabaseTriggerIndirectInjectionRule());

    // PRIVILEGE & ACCESS RULES
    this.rules.push(this.createExcessiveToolPermissionsRule());
    this.rules.push(this.createDangerousToolComboRule());
    this.rules.push(this.createUnapprovedAutomationTriggerRule());

    // INFRASTRUCTURE RULES
    this.rules.push(this.createSensitiveDataInstructionsRule());
    this.rules.push(this.createMissingInputValidationRule());
  }

  // ============================================================================
  // RULE DEFINITIONS
  // ============================================================================

  /**
   * LLM01: Prompt Injection - User input interpolated in instructions
   */
  private createPromptInjectionInterpolationRule(): SecurityRule {
    return {
      id: 'prompt-injection-interpolation',
      name: 'User input interpolated in instructions',
      riskLevel: 'critical',
      owaspRefs: [{ category: 'LLM_2025', code: 'LLM01', name: 'Prompt Injection' }],
      targetType: 'skill',
      check: (entity) => {
        const skill = entity as SerializedSkill;
        const instructions = skill.instructions || '';
        const hasInterpolation =
          instructions.includes('{{input.') ||
          instructions.includes('{user_') ||
          instructions.includes('{{user');

        if (!hasInterpolation) return null;

        return this.createViolation(
          'prompt-injection-interpolation',
          'critical',
          'skill',
          String(skill.id),
          skill.name,
          {
            title: 'User input interpolated directly into LLM instructions',
            description: `Skill "${skill.name}" interpolates user input directly into instructions without sanitization.`,
            owaspRefs: [{ category: 'LLM_2025', code: 'LLM01', name: 'Prompt Injection' }],
            evidence: {
              affectedComponents: ['instructions'],
              attackVector: 'Attacker can inject malicious prompts via skill inputs',
            },
            remediation: {
              recommendation: 'Sanitize user inputs before interpolation or use structured prompts',
              steps: [
                'Review skill inputs for user-provided text',
                'Add input validation and sanitization',
                'Consider using structured prompt templates',
              ],
              priority: 95,
            },
          }
        );
      },
    };
  }

  /**
   * LLM01: Prompt Injection - Known patterns in instructions
   */
  private createPromptInjectionPatternsRule(): SecurityRule {
    const dangerousPatterns = [
      'ignore previous',
      'disregard',
      'system prompt',
      'you are now',
      'act as',
      'pretend to be',
    ];

    return {
      id: 'prompt-injection-patterns',
      name: 'Known prompt injection patterns',
      riskLevel: 'high',
      owaspRefs: [{ category: 'LLM_2025', code: 'LLM01', name: 'Prompt Injection' }],
      targetType: 'skill',
      check: (entity) => {
        const skill = entity as SerializedSkill;
        const instructions = (skill.instructions || '').toLowerCase();
        const foundPatterns = dangerousPatterns.filter((p) => instructions.includes(p));

        if (foundPatterns.length === 0) return null;

        return this.createViolation(
          'prompt-injection-patterns',
          'high',
          'skill',
          String(skill.id),
          skill.name,
          {
            title: 'Instructions contain known prompt injection patterns',
            description: `Skill "${skill.name}" contains patterns that may indicate prompt injection vulnerability.`,
            owaspRefs: [{ category: 'LLM_2025', code: 'LLM01', name: 'Prompt Injection' }],
            evidence: {
              affectedComponents: foundPatterns,
              attackVector: 'Instructions may override system behavior or leak information',
            },
            remediation: {
              recommendation: 'Review and sanitize instructions to remove potentially dangerous patterns',
              priority: 85,
            },
          }
        );
      },
    };
  }

  /**
   * LLM01: Indirect Injection via Database Triggers
   */
  private createDatabaseTriggerIndirectInjectionRule(): SecurityRule {
    return {
      id: 'database-trigger-indirect-injection',
      name: 'Database trigger indirect injection',
      riskLevel: 'high',
      owaspRefs: [{ category: 'LLM_2025', code: 'LLM01', name: 'Prompt Injection' }],
      targetType: 'automation',
      check: (entity, context) => {
        const { automation, agent } = entity as { automation: SerializedAutomation; agent: SerializedAgent };
        if (!automation.enabled) return null;
        if (automation.trigger?.type !== 'DATABASE_EVENT') return null;

        const skill = context.getSkillById(automation.skillId);
        if (!skill) return null;

        // Check if execution is agentic (LLM-based)
        const isAgentic = skill.steps?.some(
          (s) => s.type === 'agentic' || s.executionType === 'agentic'
        );
        if (!isAgentic) return null;

        // Check if row data flows to instructions
        const inputMappings = automation.inputMappings || {};
        const hasRowDataFlow = Object.values(inputMappings).some(
          (v) => typeof v === 'string' && (v.includes('rowData') || v.includes('trigger.'))
        );

        if (!hasRowDataFlow) return null;

        return this.createViolation(
          'database-trigger-indirect-injection',
          'high',
          'automation',
          `${agent.id}:${automation.skillId}`,
          automation.name || skill.name,
          {
            title: 'Database trigger flows external data to LLM',
            description: `Automation "${automation.name || skill.name}" receives database row data that flows to agentic execution.`,
            owaspRefs: [{ category: 'LLM_2025', code: 'LLM01', name: 'Prompt Injection' }],
            evidence: {
              affectedComponents: ['trigger.rowData', 'inputMappings'],
              attackVector: 'Attacker can poison database rows to inject prompts',
            },
            remediation: {
              recommendation: 'Sanitize trigger data before passing to LLM, validate expected schema',
              steps: [
                'Add input validation for trigger data',
                'Use schema validation before processing',
                'Consider using structured data instead of free-text',
              ],
              priority: 85,
            },
          }
        );
      },
    };
  }

  /**
   * ASI02: Excessive Tool Permissions
   */
  private createExcessiveToolPermissionsRule(): SecurityRule {
    return {
      id: 'excessive-tool-permissions',
      name: 'Excessive tool permissions',
      riskLevel: 'high',
      owaspRefs: [{ category: 'AGENTIC_2026', code: 'ASI02', name: 'Tool Misuse & Exploitation' }],
      targetType: 'skill',
      check: (entity) => {
        const skill = entity as SerializedSkill;
        const tools = skill.tools || [];
        const dangerousTools = tools.filter(
          (t) =>
            t.name?.includes('write') ||
            t.name?.includes('delete') ||
            t.name?.includes('execute') ||
            t.name?.includes('send')
        );

        if (dangerousTools.length < 3) return null;

        return this.createViolation(
          'excessive-tool-permissions',
          'high',
          'skill',
          String(skill.id),
          skill.name,
          {
            title: 'Skill has excessive tool permissions',
            description: `Skill "${skill.name}" has ${dangerousTools.length} high-risk tools.`,
            owaspRefs: [{ category: 'AGENTIC_2026', code: 'ASI02', name: 'Tool Misuse & Exploitation' }],
            evidence: {
              affectedComponents: dangerousTools.map((t) => t.name).filter((n): n is string => !!n),
              attackVector: 'Compromised skill could abuse multiple dangerous tools',
            },
            remediation: {
              recommendation: 'Apply least privilege - split into separate skills with focused tool access',
              priority: 80,
            },
          }
        );
      },
    };
  }

  /**
   * ASI02: Dangerous Tool Combination
   */
  private createDangerousToolComboRule(): SecurityRule {
    return {
      id: 'dangerous-tool-combo',
      name: 'Dangerous tool combination',
      riskLevel: 'critical',
      owaspRefs: [{ category: 'AGENTIC_2026', code: 'ASI02', name: 'Tool Misuse & Exploitation' }],
      targetType: 'skill',
      check: (entity) => {
        const skill = entity as SerializedSkill;
        const tools = skill.tools || [];
        const toolNames = tools.map((t) => t.name?.toLowerCase() || '');

        const hasFileSystem = toolNames.some(
          (n) => n.includes('file') || n.includes('fs') || n.includes('disk')
        );
        const hasCodeExecution = toolNames.some(
          (n) =>
            n.includes('exec') ||
            n.includes('shell') ||
            n.includes('code') ||
            n.includes('eval')
        );

        if (!hasFileSystem || !hasCodeExecution) return null;

        return this.createViolation(
          'dangerous-tool-combo',
          'critical',
          'skill',
          String(skill.id),
          skill.name,
          {
            title: 'Skill combines file system and code execution tools',
            description: `Skill "${skill.name}" has both file system access and code execution capabilities.`,
            owaspRefs: [{ category: 'AGENTIC_2026', code: 'ASI02', name: 'Tool Misuse & Exploitation' }],
            evidence: {
              affectedComponents: toolNames.filter(
                (n) =>
                  n.includes('file') ||
                  n.includes('exec') ||
                  n.includes('shell') ||
                  n.includes('code')
              ),
              attackVector: 'Could be exploited to write and execute malicious code',
            },
            remediation: {
              recommendation: 'Separate file operations from code execution into isolated skills',
              priority: 95,
            },
          }
        );
      },
    };
  }

  /**
   * ASI01: Unapproved Automation Trigger
   */
  private createUnapprovedAutomationTriggerRule(): SecurityRule {
    return {
      id: 'unapproved-automation-trigger',
      name: 'Automation without approved plan',
      riskLevel: 'high',
      owaspRefs: [{ category: 'AGENTIC_2026', code: 'ASI01', name: 'Agent Goal Hijack' }],
      targetType: 'automation',
      check: (entity, context) => {
        const { automation, agent } = entity as { automation: SerializedAutomation; agent: SerializedAgent };
        if (!automation.enabled) return null;

        const skill = context.getSkillById(automation.skillId);
        if (!skill) return null;

        // Check if skill has approved plan
        const hasApprovedPlan = skill.steps?.some(
          (s) => s.agenticConfig?.plan?.approvedAt
        );
        if (hasApprovedPlan) return null;

        // Check if it's an external trigger
        const isExternalTrigger =
          automation.trigger?.type === 'WEBHOOK' ||
          automation.trigger?.type === 'DATABASE_EVENT' ||
          automation.trigger?.type === 'PIPEDREAM_EVENT';

        if (!isExternalTrigger) return null;

        return this.createViolation(
          'unapproved-automation-trigger',
          'high',
          'automation',
          `${agent.id}:${automation.skillId}`,
          automation.name || skill.name,
          {
            title: 'External trigger fires without approved execution plan',
            description: `Automation "${automation.name || skill.name}" can be triggered externally without prior plan approval.`,
            owaspRefs: [{ category: 'AGENTIC_2026', code: 'ASI01', name: 'Agent Goal Hijack' }],
            evidence: {
              affectedComponents: [automation.trigger?.type || 'trigger'],
              attackVector: 'External attacker could trigger automation via webhook/database/event',
            },
            remediation: {
              recommendation: 'Create and approve an execution plan for this automation',
              steps: [
                'Open the skill in the editor',
                'Generate and review the execution plan',
                'Approve the plan for autonomous execution',
              ],
              priority: 85,
            },
          }
        );
      },
    };
  }

  /**
   * LLM02: Sensitive Data in Instructions
   */
  private createSensitiveDataInstructionsRule(): SecurityRule {
    const sensitivePatterns = [
      /api[_-]?key/i,
      /secret[_-]?key/i,
      /password/i,
      /token/i,
      /credential/i,
      /sk-[a-zA-Z0-9]{20,}/,
      /pk_live_[a-zA-Z0-9]{20,}/,
    ];

    return {
      id: 'sensitive-data-instructions',
      name: 'Sensitive data in instructions',
      riskLevel: 'high',
      owaspRefs: [{ category: 'LLM_2025', code: 'LLM02', name: 'Sensitive Information Disclosure' }],
      targetType: 'skill',
      check: (entity) => {
        const skill = entity as SerializedSkill;
        const instructions = skill.instructions || '';
        const foundPatterns = sensitivePatterns.filter((p) => p.test(instructions));

        if (foundPatterns.length === 0) return null;

        return this.createViolation(
          'sensitive-data-instructions',
          'high',
          'skill',
          String(skill.id),
          skill.name,
          {
            title: 'Instructions may contain sensitive data',
            description: `Skill "${skill.name}" instructions contain patterns that may indicate hardcoded secrets.`,
            owaspRefs: [
              { category: 'LLM_2025', code: 'LLM02', name: 'Sensitive Information Disclosure' },
            ],
            evidence: {
              affectedComponents: ['instructions'],
              attackVector: 'Sensitive data could leak through LLM responses or logs',
            },
            remediation: {
              recommendation: 'Use environment variables or secret management for sensitive data',
              priority: 90,
            },
          }
        );
      },
    };
  }

  /**
   * A05: Missing Input Validation
   */
  private createMissingInputValidationRule(): SecurityRule {
    return {
      id: 'missing-input-validation',
      name: 'Missing input validation',
      riskLevel: 'medium',
      owaspRefs: [{ category: 'WEB_2025', code: 'A05', name: 'Security Misconfiguration' }],
      targetType: 'skill',
      check: (entity) => {
        const skill = entity as SerializedSkill;
        const inputs = skill.inputs || [];
        const textInputsWithoutValidation = inputs.filter(
          (i) => i.type === 'text' && i.required && !i.validation && !i.format
        );

        if (textInputsWithoutValidation.length === 0) return null;

        return this.createViolation(
          'missing-input-validation',
          'medium',
          'skill',
          String(skill.id),
          skill.name,
          {
            title: 'Required text inputs without validation',
            description: `Skill "${skill.name}" has ${textInputsWithoutValidation.length} required text inputs without type/format constraints.`,
            owaspRefs: [{ category: 'WEB_2025', code: 'A05', name: 'Security Misconfiguration' }],
            evidence: {
              affectedComponents: textInputsWithoutValidation.map((i) => i.name || i.key).filter((n): n is string => !!n),
              attackVector: 'Unvalidated inputs could be exploited for injection attacks',
            },
            remediation: {
              recommendation: 'Add validation rules or format constraints to required inputs',
              priority: 60,
            },
          }
        );
      },
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private createViolation(
    ruleId: string,
    riskLevel: RiskLevel,
    resourceType: 'agent' | 'skill' | 'automation' | 'delegation',
    resourceId: string,
    resourceName: string,
    findingData: Omit<SecurityFindingData, 'ruleId' | 'resource'>
  ): RuleViolation {
    return {
      ruleId,
      riskLevel,
      resourceType,
      resourceId,
      resourceName,
      findingData: {
        ruleId,
        resource: {
          type: resourceType,
          id: resourceId,
          name: resourceName,
        },
        ...findingData,
      },
    };
  }
}
