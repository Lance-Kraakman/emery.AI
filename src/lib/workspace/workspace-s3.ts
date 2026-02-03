/**
 * Workspace S3 Service — Read agent workspaces from S3 for frontend access.
 *
 * Agent workspaces are stored as tar.gz archives in S3 by the Python
 * WorkspaceSync service. This module reads them for download/inspection.
 *
 * S3 key pattern: workspaces/agents/{agentId}.tar.gz
 * NOTE: This does NOT follow the org_{id}/... pattern used by file storage.
 *       Access is validated via agent ownership, not S3 key prefix.
 */

import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME } from '@/lib/s3/client';
import { getAgentWorkspaceKey } from '@/lib/s3/path-registry';
import type { Readable } from 'stream';

export class WorkspaceS3Service {
  /**
   * Get S3 key for an agent's workspace archive.
   * Uses the shared path registry for consistency.
   */
  static getWorkspaceKey(agentId: number): string {
    return getAgentWorkspaceKey(agentId);
  }

  /**
   * Check if an agent workspace exists in S3.
   */
  static async exists(agentId: number): Promise<boolean> {
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: this.getWorkspaceKey(agentId),
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Download an agent's workspace archive as a readable stream.
   *
   * Returns the raw tar.gz stream from S3, suitable for piping
   * directly to an HTTP response.
   *
   * @returns Object with body stream, content length, and last modified date
   * @throws Error if workspace does not exist
   */
  static async downloadArchive(agentId: number): Promise<{
    body: Readable;
    contentLength: number;
    lastModified?: Date;
  }> {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: this.getWorkspaceKey(agentId),
      })
    );

    if (!response.Body) {
      throw new Error(`Empty response for workspace ${agentId}`);
    }

    return {
      body: response.Body as Readable,
      contentLength: response.ContentLength ?? 0,
      lastModified: response.LastModified,
    };
  }
}
