// AIDEV-NOTE: Domain error for unauthorized credential usage
// Thrown when agent attempts to use OAuth credentials without proper delegation
// Critical security error - should be logged and monitored

export class UnauthorizedCredentialUsageError extends Error {
  constructor(
    public readonly agentId: number,
    public readonly agentName: string,
    public readonly service: string,
    public readonly ownerId: string
  ) {
    super(
      `Agent "${agentName}" (ID: ${agentId}) is not authorized to use ${service} credentials from owner ${ownerId}. ` +
      `Delegation must be approved before agent can access this service.`
    );
    this.name = 'UnauthorizedCredentialUsageError';

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnauthorizedCredentialUsageError);
    }
  }
}
