/**
 * Workspace S3 Service — Read agent workspaces from S3 for frontend access.
 *
 * Agent workspaces are stored as tar.gz archives in S3 by the Python
 * WorkspaceSync service. This module reads them for download/inspection.
 *
 * S3 key pattern: workspaces/{orgId}/agents/{agentId}.tar.gz
 */

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME } from '@/lib/s3/client';
import { getAgentWorkspaceKey } from '@/lib/s3/path-registry';
import type { Readable } from 'stream';

export class WorkspaceS3Service {
  /**
   * Get S3 key for an agent's workspace archive.
   * Uses the shared path registry for consistency.
   */
  static getWorkspaceKey(organizationId: number, agentId: number): string {
    return getAgentWorkspaceKey(organizationId, agentId);
  }

  /**
   * Check if an agent workspace exists in S3.
   */
  static async exists(organizationId: number, agentId: number): Promise<boolean> {
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: this.getWorkspaceKey(organizationId, agentId),
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get metadata for an agent's workspace archive without downloading.
   *
   * @returns Object with content length and last modified date, or null if not exists
   */
  static async getMetadata(organizationId: number, agentId: number): Promise<{
    contentLength: number;
    lastModified?: Date;
  } | null> {
    try {
      const response = await s3Client.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: this.getWorkspaceKey(organizationId, agentId),
        })
      );

      return {
        contentLength: response.ContentLength ?? 0,
        lastModified: response.LastModified,
      };
    } catch {
      return null;
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
  static async downloadArchive(organizationId: number, agentId: number): Promise<{
    body: Readable;
    contentLength: number;
    lastModified?: Date;
  }> {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: this.getWorkspaceKey(organizationId, agentId),
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

  /**
   * Upload a workspace archive to S3.
   *
   * @param organizationId - The organization ID
   * @param agentId - The agent ID
   * @param body - The tar.gz archive data
   * @returns The last modified date after upload
   */
  static async uploadArchive(
    organizationId: number,
    agentId: number,
    body: Buffer | Uint8Array
  ): Promise<{ lastModified: Date }> {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: this.getWorkspaceKey(organizationId, agentId),
        Body: body,
        ContentType: 'application/gzip',
      })
    );

    // Return current time as the effective last modified
    return { lastModified: new Date() };
  }
}
