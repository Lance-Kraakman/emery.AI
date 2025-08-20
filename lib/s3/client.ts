import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  endpoint: process.env.S3_ENDPOINT_URL,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});

export { s3Client };
export const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'emery-files';
