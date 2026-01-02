/**
 * S3 Key Validation
 *
 * SECURITY: Prevents path traversal attacks on S3 file operations.
 *
 * Expected key format: org_{orgId}/{path_segments}/{filename}
 * Examples:
 * - org_123/table_456/field_789/abc123_document.pdf
 * - org_123/app_456/page_789/image.png
 */

/**
 * Validate an S3 key to prevent path traversal attacks
 *
 * @returns null if valid, error message if invalid
 */
export function validateS3Key(s3Key: string): string | null {
  // Check for path traversal attempts
  if (s3Key.includes('..')) {
    return 'Invalid key: path traversal detected';
  }

  // Check for URL encoding that could be used for traversal
  // %2e = '.', %2f = '/'
  if (/%2[eEfF]/i.test(s3Key)) {
    return 'Invalid key: encoded traversal detected';
  }

  // Check for null bytes
  if (s3Key.includes('\0') || s3Key.includes('%00')) {
    return 'Invalid key: null byte detected';
  }

  // Must start with org_ prefix
  if (!s3Key.startsWith('org_')) {
    return 'Invalid key: must start with org_ prefix';
  }

  // Validate key format with strict regex
  // Pattern: org_{number}/followed by allowed characters
  // Allowed characters: alphanumeric, underscores, hyphens, periods, forward slashes
  const validKeyPattern = /^org_\d+\/[a-zA-Z0-9_\-./]+$/;
  if (!validKeyPattern.test(s3Key)) {
    return 'Invalid key: contains disallowed characters';
  }

  // Ensure no double slashes (could indicate manipulation)
  if (s3Key.includes('//')) {
    return 'Invalid key: double slashes detected';
  }

  // Must have at least 2 path segments (org_X/something)
  const segments = s3Key.split('/').filter(Boolean);
  if (segments.length < 2) {
    return 'Invalid key: insufficient path depth';
  }

  // Validate org segment format
  const orgSegment = segments[0];
  if (!/^org_\d+$/.test(orgSegment)) {
    return 'Invalid key: malformed org segment';
  }

  return null; // Valid
}

/**
 * Extract organization ID from S3 key
 *
 * @returns org ID if valid, null otherwise
 */
export function extractOrgIdFromS3Key(s3Key: string): number | null {
  const match = s3Key.match(/^org_(\d+)\//);
  if (!match) return null;

  const orgId = parseInt(match[1], 10);
  return isNaN(orgId) ? null : orgId;
}

/**
 * Validate S3 key and check organization access
 *
 * @returns error message if invalid or unauthorized, null if valid
 */
export function validateS3KeyWithOrgAccess(
  s3Key: string,
  userOrgId: number | undefined | null
): string | null {
  // First validate key format
  const formatError = validateS3Key(s3Key);
  if (formatError) {
    return formatError;
  }

  // Check organization access
  const keyOrgId = extractOrgIdFromS3Key(s3Key);
  if (keyOrgId === null) {
    return 'Invalid key: could not extract org ID';
  }

  if (userOrgId != null && keyOrgId !== userOrgId) {
    return 'Access denied: file not in your organization';
  }

  return null; // Valid and authorized
}
