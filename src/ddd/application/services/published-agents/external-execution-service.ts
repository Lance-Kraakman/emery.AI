/**
 * External Execution Service
 *
 * Handles execution of tasks and skills via the external API gateway.
 * Validates access, checks rate limits, executes, and logs usage.
 */

import type {
  IPublishedAgentRepository,
  IPublishedAgentApiKeyRepository,
  IPublishedAgentUsageLogRepository,
} from '@/ddd/domain/published-agents';
import type { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type {
  PublishedAgent,
  ExecutionResult,
} from '@/ddd/domain/published-agents/types';
import type { Result } from '@/ddd/domain/shared/result';
import { AgentId } from '@/ddd/domain/shared/value-objects';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('ExternalExecutionService');

// ============================================================================
// RATE LIMITER (In-Memory for now, should use Redis in production)
// ============================================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

class InMemoryRateLimiter {
  private minuteWindows: Map<string, RateLimitEntry> = new Map();
  private dayWindows: Map<string, RateLimitEntry> = new Map();

  check(
    publishedAgentId: number,
    limitPerMinute: number,
    limitPerDay: number
  ): { allowed: boolean; remaining: number; resetAt: Date } {
    const now = Date.now();
    const minuteKey = `${publishedAgentId}:minute`;
    const dayKey = `${publishedAgentId}:day`;

    // Check minute window
    const minuteEntry = this.minuteWindows.get(minuteKey);
    const minuteWindowStart = Math.floor(now / 60000) * 60000;

    if (!minuteEntry || minuteEntry.windowStart !== minuteWindowStart) {
      this.minuteWindows.set(minuteKey, { count: 0, windowStart: minuteWindowStart });
    }

    const currentMinuteCount = (this.minuteWindows.get(minuteKey)?.count ?? 0) + 1;
    if (currentMinuteCount > limitPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(minuteWindowStart + 60000),
      };
    }

    // Check day window
    const dayEntry = this.dayWindows.get(dayKey);
    const dayWindowStart = Math.floor(now / 86400000) * 86400000;

    if (!dayEntry || dayEntry.windowStart !== dayWindowStart) {
      this.dayWindows.set(dayKey, { count: 0, windowStart: dayWindowStart });
    }

    const currentDayCount = (this.dayWindows.get(dayKey)?.count ?? 0) + 1;
    if (currentDayCount > limitPerDay) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(dayWindowStart + 86400000),
      };
    }

    // Increment counters
    this.minuteWindows.set(minuteKey, { count: currentMinuteCount, windowStart: minuteWindowStart });
    this.dayWindows.set(dayKey, { count: currentDayCount, windowStart: dayWindowStart });

    return {
      allowed: true,
      remaining: Math.min(limitPerMinute - currentMinuteCount, limitPerDay - currentDayCount),
      resetAt: new Date(minuteWindowStart + 60000),
    };
  }
}

// ============================================================================
// SERVICE
// ============================================================================

export class ExternalExecutionService {
  private rateLimiter = new InMemoryRateLimiter();

  constructor(
    private readonly publishedAgentRepository: IPublishedAgentRepository,
    private readonly apiKeyRepository: IPublishedAgentApiKeyRepository,
    private readonly usageLogRepository: IPublishedAgentUsageLogRepository,
    private readonly skillRepository: ISkillRepository,
    private readonly agentRepository: IAgentRepository
  ) {}

  /**
   * Execute a natural language task on a published agent
   */
  async executeTask(
    slug: string,
    organizationId: number,
    task: string,
    apiKeyId: number,
    context?: {
      clientIp?: string;
      userAgent?: string;
    }
  ): Promise<Result<ExecutionResult>> {
    const startTime = Date.now();

    try {
      // 1. Get published agent
      const publishedAgent = await this.publishedAgentRepository.findBySlug(organizationId, slug);
      if (!publishedAgent) {
        return { success: false, error: 'Published agent not found' };
      }

      // 2. Validate agent is published and task mode is allowed
      const validation = this.validateAccess(publishedAgent, 'task');
      if (!validation.success) {
        await this.logUsage(publishedAgent.id, apiKeyId, 'task', null, 403, startTime, context);
        return { success: false, error: validation.error };
      }

      // 3. Check rate limits
      const rateLimit = this.rateLimiter.check(
        publishedAgent.id,
        publishedAgent.rateLimitPerMinute,
        publishedAgent.rateLimitPerDay
      );
      if (!rateLimit.allowed) {
        await this.logUsage(publishedAgent.id, apiKeyId, 'task', null, 429, startTime, context);
        return {
          success: false,
          error: `Rate limit exceeded. Resets at ${rateLimit.resetAt.toISOString()}`,
        };
      }

      // 4. Get the agent
      const agent = await this.agentRepository.findById(AgentId.fromNumber(publishedAgent.agentId));
      if (!agent) {
        await this.logUsage(publishedAgent.id, apiKeyId, 'task', null, 500, startTime, context);
        return { success: false, error: 'Agent not found' };
      }

      // 5. Execute task
      // NOTE: This is a placeholder. In a full implementation, this would:
      // - Create a task via AgentTaskApplicationService
      // - Wait for execution to complete
      // - Return the result
      //
      // For now, we'll return a placeholder response indicating the
      // execution would be queued.
      logger.debug(`[ExternalExecution] Task queued for agent ${publishedAgent.slug}: ${task.substring(0, 100)}...`);

      const executionResult: ExecutionResult = {
        success: true,
        output: {
          status: 'queued',
          message: `Task has been queued for execution by agent "${agent.name}"`,
          task: task.substring(0, 200),
        },
        executionTimeMs: Date.now() - startTime,
      };

      await this.logUsage(publishedAgent.id, apiKeyId, 'task', null, 200, startTime, context);

      return { success: true, data: executionResult };
    } catch (error) {
      logger.error('[ExternalExecution] Task execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Task execution failed',
      };
    }
  }

  /**
   * Execute a specific skill with typed inputs
   */
  async executeSkill(
    slug: string,
    organizationId: number,
    skillName: string,
    inputs: Record<string, unknown>,
    apiKeyId: number,
    context?: {
      clientIp?: string;
      userAgent?: string;
    }
  ): Promise<Result<ExecutionResult>> {
    const startTime = Date.now();

    try {
      // 1. Get published agent
      const publishedAgent = await this.publishedAgentRepository.findBySlug(organizationId, slug);
      if (!publishedAgent) {
        return { success: false, error: 'Published agent not found' };
      }

      // 2. Validate agent is published and skill mode is allowed
      const validation = this.validateAccess(publishedAgent, 'skill');
      if (!validation.success) {
        await this.logUsage(publishedAgent.id, apiKeyId, 'skill', skillName, 403, startTime, context);
        return { success: false, error: validation.error };
      }

      // 3. Check rate limits
      const rateLimit = this.rateLimiter.check(
        publishedAgent.id,
        publishedAgent.rateLimitPerMinute,
        publishedAgent.rateLimitPerDay
      );
      if (!rateLimit.allowed) {
        await this.logUsage(publishedAgent.id, apiKeyId, 'skill', skillName, 429, startTime, context);
        return {
          success: false,
          error: `Rate limit exceeded. Resets at ${rateLimit.resetAt.toISOString()}`,
        };
      }

      // 4. Find the skill
      const agentId = AgentId.fromNumber(publishedAgent.agentId);

      // Get skills for this agent
      const skills = await this.skillRepository.findByAgentId(agentId);
      const skill = skills.find(s => s.name === skillName);

      if (!skill) {
        await this.logUsage(publishedAgent.id, apiKeyId, 'skill', skillName, 404, startTime, context);
        return { success: false, error: `Skill "${skillName}" not found on this agent` };
      }

      // 5. Validate inputs against skill schema
      const inputValidation = this.validateSkillInputs(skill.inputs, inputs);
      if (!inputValidation.valid) {
        await this.logUsage(publishedAgent.id, apiKeyId, 'skill', skillName, 400, startTime, context);
        return { success: false, error: `Invalid inputs: ${inputValidation.errors.join(', ')}` };
      }

      // 6. Execute skill
      // NOTE: This is a placeholder. In a full implementation, this would:
      // - Create a task with skillId set
      // - Execute via the worker
      // - Return the typed output
      logger.debug(`[ExternalExecution] Skill "${skillName}" queued for agent ${publishedAgent.slug}`);

      const executionResult: ExecutionResult = {
        success: true,
        output: {
          status: 'queued',
          message: `Skill "${skillName}" has been queued for execution`,
          skillName,
          inputs,
        },
        executionTimeMs: Date.now() - startTime,
      };

      await this.logUsage(publishedAgent.id, apiKeyId, 'skill', skillName, 200, startTime, context);

      return { success: true, data: executionResult };
    } catch (error) {
      logger.error('[ExternalExecution] Skill execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Skill execution failed',
      };
    }
  }

  /**
   * Get available skills for a published agent (for OpenAPI spec generation)
   */
  async getAvailableSkills(
    slug: string,
    organizationId: number
  ): Promise<Result<Array<{ name: string; description: string; inputs: unknown[]; outputs: unknown[] }>>> {
    try {
      const publishedAgent = await this.publishedAgentRepository.findBySlug(organizationId, slug);
      if (!publishedAgent) {
        return { success: false, error: 'Published agent not found' };
      }

      if (publishedAgent.status !== 'published') {
        return { success: false, error: 'Agent is not published' };
      }

      const agentId = AgentId.fromNumber(publishedAgent.agentId);

      const skills = await this.skillRepository.findByAgentId(agentId);

      return {
        success: true,
        data: skills.map(s => ({
          name: s.name,
          description: s.description,
          inputs: s.inputs,
          outputs: s.outputs,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get skills',
      };
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private validateAccess(
    publishedAgent: PublishedAgent,
    mode: 'task' | 'skill'
  ): Result<void> {
    if (publishedAgent.status !== 'published') {
      return {
        success: false,
        error: `Agent is not available (status: ${publishedAgent.status})`,
      };
    }

    if (mode === 'task' && !publishedAgent.allowTaskMode) {
      return { success: false, error: 'Task mode is not enabled for this agent' };
    }

    if (mode === 'skill' && !publishedAgent.allowSkillMode) {
      return { success: false, error: 'Skill mode is not enabled for this agent' };
    }

    return { success: true, data: undefined };
  }

  private validateSkillInputs(
    schema: unknown[],
    inputs: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation - check required inputs are present
    for (const inputDef of schema as Array<{ name: string; required?: boolean }>) {
      if (inputDef.required && !(inputDef.name in inputs)) {
        errors.push(`Missing required input: ${inputDef.name}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private async logUsage(
    publishedAgentId: number,
    apiKeyId: number,
    requestType: 'task' | 'skill',
    skillName: string | null,
    statusCode: number,
    startTime: number,
    context?: { clientIp?: string; userAgent?: string }
  ): Promise<void> {
    try {
      await this.usageLogRepository.create({
        publishedAgentId,
        apiKeyId,
        requestType,
        skillName: skillName ?? undefined,
        statusCode,
        responseTimeMs: Date.now() - startTime,
        clientIp: context?.clientIp,
        userAgent: context?.userAgent,
      });
    } catch (error) {
      logger.error('[ExternalExecution] Failed to log usage:', error);
    }
  }
}
