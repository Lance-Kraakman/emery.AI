/**
 * OAuth Proxy Audit Logger
 *
 * SECURITY: Logs all OAuth credential usage for audit trail
 * Records: who executed, which agent, whose credentials, what service/action, result
 */

export interface OAuthAuditEntry {
  timestamp: string;
  eventType: 'oauth_call' | 'delegation_check' | 'unauthorized_attempt';

  // Identity
  agentId: number;
  agentName: string;
  credentialOwnerId: string;  // Whose OAuth credentials are being used

  // Request details
  service: string;
  action: string;

  // Result
  success: boolean;
  error?: string;

  // Additional context
  delegationId?: number;
  metadata?: Record<string, unknown>;
}

class OAuthAuditLogger {
  /**
   * Log an OAuth proxy call
   */
  logOAuthCall(entry: Omit<OAuthAuditEntry, 'timestamp' | 'eventType'>): void {
    const auditEntry: OAuthAuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      eventType: 'oauth_call'
    };

    // Structured log for production monitoring/alerting
    console.log('[OAUTH-AUDIT]', JSON.stringify(auditEntry));

    // Also log human-readable summary
    if (entry.success) {
      console.log(
        `[OAUTH-AUDIT] Agent ${entry.agentId} (${entry.agentName}) called ${entry.service}.${entry.action} ` +
        `using credentials of user ${entry.credentialOwnerId}`
      );
    } else {
      console.warn(
        `[OAUTH-AUDIT] FAILED: Agent ${entry.agentId} (${entry.agentName}) attempted ${entry.service}.${entry.action} ` +
        `using credentials of user ${entry.credentialOwnerId} - Error: ${entry.error}`
      );
    }
  }

  /**
   * Log a delegation check (for debugging/monitoring)
   */
  logDelegationCheck(entry: {
    agentId: number;
    agentName: string;
    service: string;
    hasPermission: boolean;
    delegationId?: number;
  }): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      eventType: 'delegation_check',
      ...entry
    };

    console.log('[OAUTH-AUDIT] Delegation check:', JSON.stringify(auditEntry));
  }

  /**
   * Log an unauthorized credential usage attempt
   */
  logUnauthorizedAttempt(entry: {
    agentId: number;
    agentName: string;
    credentialOwnerId: string;
    service: string;
    reason: string;
  }): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      eventType: 'unauthorized_attempt',
      ...entry
    };

    // Always log unauthorized attempts prominently
    console.error('[OAUTH-AUDIT] UNAUTHORIZED ATTEMPT:', JSON.stringify(auditEntry));
  }
}

// Singleton instance
export const oauthAuditLogger = new OAuthAuditLogger();
