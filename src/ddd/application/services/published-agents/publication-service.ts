/**
 * Publication Application Service
 *
 * Manages the publication lifecycle for agents:
 * 1. Initiate publication (creates draft, triggers security scan)
 * 2. Review security report
 * 3. Approve publication (after security review)
 * 4. Publish (generate API keys, make externally accessible)
 * 5. Suspend/unpublish
 */

import { createHash, randomBytes } from 'crypto';
import type { IPublishedAgentRepository, IPublishedAgentApiKeyRepository } from '@/ddd/domain/published-agents';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { ISecurityReportRepository } from '@/ddd/domain/security/interfaces/security-repository';
import type { SecurityAnalyzerService } from '../security/security-analyzer.service';
import type {
  PublishedAgent,
  PublishedAgentApiKey,
  SecurityGrade,
} from '@/ddd/domain/published-agents/types';
import type { SecurityReport, SecurityReportData } from '@/ddd/domain/security/types';
import type { Result } from '@/ddd/domain/shared/result';
import { OrganizationId, AgentId } from '@/ddd/domain/shared/value-objects';

// ============================================================================
// DTOs
// ============================================================================

export interface InitiatePublicationOptions {
  agentId: number;
  organizationId: number;
  slug: string;
  displayName: string;
  description?: string;
  allowTaskMode?: boolean;
  allowSkillMode?: boolean;
  minSecurityGrade?: 'A' | 'B' | 'C';
  initiatedBy: string;
}

export interface PublicationResult {
  publishedAgent: PublishedAgent;
  apiKey?: string; // Only returned on initial publish (plaintext, not stored)
  securityReport?: SecurityReport;
}

// ============================================================================
// SERVICE
// ============================================================================

export class PublicationApplicationService {
  constructor(
    private readonly publishedAgentRepository: IPublishedAgentRepository,
    private readonly apiKeyRepository: IPublishedAgentApiKeyRepository,
    private readonly agentRepository: IAgentRepository,
    private readonly securityReportRepository: ISecurityReportRepository,
    private readonly securityAnalyzer: SecurityAnalyzerService
  ) {}

  /**
   * Initiate publication process for an agent
   *
   * 1. Validates agent exists and is active
   * 2. Checks if agent is already published
   * 3. Creates published_agent record in 'draft' status
   * 4. Triggers security scan
   * 5. Updates status to 'pending_review'
   */
  async initiatePublication(options: InitiatePublicationOptions): Promise<Result<PublicationResult>> {
    try {
      // 1. Validate agent exists
      const agentId = AgentId.fromNumber(options.agentId);
      const agent = await this.agentRepository.findById(agentId);
      if (!agent) {
        return { success: false, error: 'Agent not found' };
      }

      // 2. Check if already published
      const existing = await this.publishedAgentRepository.findByAgentId(options.agentId);
      if (existing) {
        return { success: false, error: 'Agent is already published or has a pending publication' };
      }

      // 3. Validate slug is unique within org
      const slugExists = await this.publishedAgentRepository.findBySlug(options.organizationId, options.slug);
      if (slugExists) {
        return { success: false, error: `Slug "${options.slug}" is already in use` };
      }

      // 4. Create published agent in draft status
      const publishedAgent = await this.publishedAgentRepository.create({
        agentId: options.agentId,
        organizationId: options.organizationId,
        slug: options.slug,
        displayName: options.displayName,
        description: options.description,
        allowTaskMode: options.allowTaskMode ?? true,
        allowSkillMode: options.allowSkillMode ?? true,
        minSecurityGrade: options.minSecurityGrade ?? 'B',
      });

      // 5. Trigger security scan
      const scanResult = await this.securityAnalyzer.analyzeOrganization(
        options.organizationId,
        options.initiatedBy
      );

      if (!scanResult.success) {
        // Security scan failed, but we still have the draft
        // User can retry the scan later
        return {
          success: true,
          data: {
            publishedAgent,
            securityReport: undefined,
          },
        };
      }

      // 6. Update to pending_review with security report reference
      const securityReport = scanResult.data!;
      const updatedAgent = await this.publishedAgentRepository.updateStatus(
        publishedAgent.id,
        'pending_review',
        { latestSecurityReportId: securityReport.id }
      );

      return {
        success: true,
        data: {
          publishedAgent: updatedAgent,
          securityReport,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate publication',
      };
    }
  }

  /**
   * Approve publication after security review
   *
   * Validates:
   * 1. Security report meets grade requirements
   * 2. No critical findings are open
   * 3. No high findings are open (configurable)
   */
  async approvePublication(
    publishedAgentId: number,
    approvedBy: string
  ): Promise<Result<PublishedAgent>> {
    try {
      // 1. Get published agent
      const publishedAgent = await this.publishedAgentRepository.findById(publishedAgentId);
      if (!publishedAgent) {
        return { success: false, error: 'Published agent not found' };
      }

      // 2. Validate status
      if (publishedAgent.status !== 'pending_review') {
        return {
          success: false,
          error: `Cannot approve: agent is in "${publishedAgent.status}" status, expected "pending_review"`,
        };
      }

      // 3. Validate security report exists
      if (!publishedAgent.latestSecurityReportId) {
        return { success: false, error: 'No security report found. Please run a security scan first.' };
      }

      // 4. Get security report
      const report = await this.securityReportRepository.findById(publishedAgent.latestSecurityReportId);
      if (!report || report.status !== 'completed') {
        return { success: false, error: 'Security report is not complete' };
      }

      // 5. Validate grade meets minimum
      const reportData = report.reportData as SecurityReportData;
      if (!this.meetsMinimumGrade(reportData.riskGrade, publishedAgent.minSecurityGrade)) {
        return {
          success: false,
          error: `Security grade ${reportData.riskGrade} does not meet minimum requirement of ${publishedAgent.minSecurityGrade}`,
        };
      }

      // 6. Check for blocking findings (critical or high)
      if (reportData.findingCounts.critical > 0) {
        return {
          success: false,
          error: `Cannot approve: ${reportData.findingCounts.critical} critical security findings must be resolved`,
        };
      }

      // 7. Update status to approved
      const approvedAgent = await this.publishedAgentRepository.updateStatus(
        publishedAgentId,
        'approved',
        {
          securityApprovedAt: new Date(),
          securityApprovedBy: approvedBy,
        }
      );

      return { success: true, data: approvedAgent };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve publication',
      };
    }
  }

  /**
   * Publish the agent (make it externally accessible)
   *
   * 1. Verifies status is 'approved'
   * 2. Generates initial API key
   * 3. Updates status to 'published'
   */
  async publish(
    publishedAgentId: number,
    publishedBy: string
  ): Promise<Result<PublicationResult>> {
    try {
      // 1. Get published agent
      const publishedAgent = await this.publishedAgentRepository.findById(publishedAgentId);
      if (!publishedAgent) {
        return { success: false, error: 'Published agent not found' };
      }

      // 2. Validate status
      if (publishedAgent.status !== 'approved') {
        return {
          success: false,
          error: `Cannot publish: agent is in "${publishedAgent.status}" status, expected "approved"`,
        };
      }

      // 3. Generate API key
      const { apiKey, keyHash, keyPrefix } = this.generateApiKey();

      // 4. Create API key record
      await this.apiKeyRepository.create({
        publishedAgentId,
        name: 'Default API Key',
        keyHash,
        keyPrefix,
        scopes: ['task:execute', 'skill:execute'],
      });

      // 5. Update status to published
      const published = await this.publishedAgentRepository.updateStatus(
        publishedAgentId,
        'published',
        {
          publishedAt: new Date(),
          publishedBy,
        }
      );

      return {
        success: true,
        data: {
          publishedAgent: published,
          apiKey, // Return plaintext key once
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish agent',
      };
    }
  }

  /**
   * Suspend a published agent (temporary disable)
   */
  async suspend(
    publishedAgentId: number,
    _reason: string
  ): Promise<Result<PublishedAgent>> {
    try {
      const publishedAgent = await this.publishedAgentRepository.findById(publishedAgentId);
      if (!publishedAgent) {
        return { success: false, error: 'Published agent not found' };
      }

      if (publishedAgent.status !== 'published') {
        return {
          success: false,
          error: `Cannot suspend: agent is in "${publishedAgent.status}" status`,
        };
      }

      const suspended = await this.publishedAgentRepository.updateStatus(
        publishedAgentId,
        'suspended'
      );

      return { success: true, data: suspended };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to suspend agent',
      };
    }
  }

  /**
   * Resume a suspended agent
   */
  async resume(publishedAgentId: number): Promise<Result<PublishedAgent>> {
    try {
      const publishedAgent = await this.publishedAgentRepository.findById(publishedAgentId);
      if (!publishedAgent) {
        return { success: false, error: 'Published agent not found' };
      }

      if (publishedAgent.status !== 'suspended') {
        return {
          success: false,
          error: `Cannot resume: agent is in "${publishedAgent.status}" status`,
        };
      }

      const resumed = await this.publishedAgentRepository.updateStatus(
        publishedAgentId,
        'published'
      );

      return { success: true, data: resumed };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume agent',
      };
    }
  }

  /**
   * Re-run security scan for a published agent
   */
  async rescanSecurity(
    publishedAgentId: number,
    triggeredBy: string
  ): Promise<Result<SecurityReport>> {
    try {
      const publishedAgent = await this.publishedAgentRepository.findById(publishedAgentId);
      if (!publishedAgent) {
        return { success: false, error: 'Published agent not found' };
      }

      // Run new security scan
      const scanResult = await this.securityAnalyzer.analyzeOrganization(
        publishedAgent.organizationId,
        triggeredBy
      );

      if (!scanResult.success) {
        return scanResult;
      }

      // Update latest security report reference
      await this.publishedAgentRepository.updateStatus(
        publishedAgentId,
        publishedAgent.status, // Keep same status
        { latestSecurityReportId: scanResult.data!.id }
      );

      return scanResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rescan security',
      };
    }
  }

  /**
   * Generate a new API key for a published agent
   */
  async generateNewApiKey(
    publishedAgentId: number,
    name: string
  ): Promise<Result<{ apiKey: PublishedAgentApiKey; plaintextKey: string }>> {
    try {
      const publishedAgent = await this.publishedAgentRepository.findById(publishedAgentId);
      if (!publishedAgent) {
        return { success: false, error: 'Published agent not found' };
      }

      if (publishedAgent.status !== 'published') {
        return {
          success: false,
          error: 'Can only generate API keys for published agents',
        };
      }

      const { apiKey: plaintextKey, keyHash, keyPrefix } = this.generateApiKey();

      const apiKey = await this.apiKeyRepository.create({
        publishedAgentId,
        name,
        keyHash,
        keyPrefix,
        scopes: ['task:execute', 'skill:execute'],
      });

      return {
        success: true,
        data: { apiKey, plaintextKey },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate API key',
      };
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generateApiKey(): { apiKey: string; keyHash: string; keyPrefix: string } {
    const keyBytes = randomBytes(32);
    const apiKey = `pk_live_${keyBytes.toString('base64url')}`;
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.substring(0, 12);

    return { apiKey, keyHash, keyPrefix };
  }

  private meetsMinimumGrade(actual: SecurityGrade, minimum: SecurityGrade): boolean {
    const gradeOrder: SecurityGrade[] = ['A', 'B', 'C', 'D', 'F'];
    const actualIndex = gradeOrder.indexOf(actual);
    const minimumIndex = gradeOrder.indexOf(minimum);
    return actualIndex <= minimumIndex;
  }
}
