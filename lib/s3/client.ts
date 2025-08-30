import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  endpoint: process.env.S3_ENDPOINT_URL,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});

export const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'emery-files';

// Ensure bucket exists - create if it doesn't
export async function ensureBucketExists(): Promise<void> {
  try {
    // Check if bucket exists
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch (error: any) {
    if (error.name === 'NoSuchBucket' || error.$metadata?.httpStatusCode === 404) {
      // Bucket doesn't exist, create it
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        console.log(`✅ Created S3 bucket: ${BUCKET_NAME}`);
      } catch (createError) {
        console.error(`❌ Failed to create S3 bucket: ${BUCKET_NAME}`, createError);
        throw createError;
      }
    } else {
      // Some other error occurred
      throw error;
    }
  }
}

export { s3Client };
