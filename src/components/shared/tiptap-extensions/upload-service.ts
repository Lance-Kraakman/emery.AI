/**
 * Upload Service for TipTap File Handling
 *
 * Handles file uploads to S3 via the API.
 */

export interface UploadResult {
  url: string;
  s3Key: string;
}

/**
 * Upload a file to S3 via the API
 */
export async function uploadFileToS3(
  file: File,
  organizationId: number,
  tableId: number,
  fieldId: number
): Promise<UploadResult | null> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('organizationId', organizationId.toString());
  formData.append('tableId', tableId.toString());
  formData.append('fieldId', fieldId.toString());

  try {
    console.log('[upload-service] Uploading file:', file.name, 'size:', file.size);

    const response = await fetch('/api/files/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[upload-service] Upload failed:', errorData.error || response.status);
      throw new Error(errorData.error || `Upload failed with status ${response.status}`);
    }

    const result = await response.json();
    const s3Key = result.data.s3Key;

    console.log('[upload-service] File uploaded, s3Key:', s3Key);

    // Get a signed URL for display
    const urlResponse = await fetch(
      `/api/files/download-url?s3Key=${encodeURIComponent(s3Key)}`
    );

    if (!urlResponse.ok) {
      console.error('[upload-service] Failed to get download URL');
      throw new Error('Failed to get download URL');
    }

    const urlResult = await urlResponse.json();

    console.log('[upload-service] Got download URL, length:', urlResult.data.downloadUrl.length);

    return {
      url: urlResult.data.downloadUrl,
      s3Key,
    };
  } catch (error) {
    console.error('[upload-service] File upload error:', error);
    return null;
  }
}

/**
 * Upload a Blob to S3 and return the URL
 */
export async function uploadBlobToS3(
  blob: Blob,
  filename: string,
  organizationId: number,
  tableId: number,
  fieldId: number
): Promise<UploadResult | null> {
  const file = new File([blob], filename, { type: blob.type });
  return uploadFileToS3(file, organizationId, tableId, fieldId);
}

/**
 * Fetch an external image via our proxy API (to avoid CORS issues)
 */
export async function fetchExternalImage(url: string): Promise<Blob | null> {
  try {
    console.log('[upload-service] Fetching external image:', url.substring(0, 80));

    const response = await fetch(`/api/files/fetch-external?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      console.error('[upload-service] Failed to fetch external image:', response.status, response.statusText);
      return null;
    }

    const blob = await response.blob();
    console.log('[upload-service] Fetched external image, size:', blob.size);
    return blob;
  } catch (error) {
    console.error('[upload-service] Error fetching external image:', error);
    return null;
  }
}
