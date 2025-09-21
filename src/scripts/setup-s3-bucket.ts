import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT_URL || 'http://localhost:9000',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'emery',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dashlet123',
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'emery-files';

async function createBucketIfNotExists() {
  try {
    // Check if bucket exists
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✅ Bucket ${BUCKET_NAME} already exists`);
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      try {
        // Create bucket
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        console.log(`✅ Created bucket ${BUCKET_NAME}`);
      } catch (createError) {
        console.error(`❌ Failed to create bucket:`, createError);
        process.exit(1);
      }
    } else {
      console.error(`❌ Error checking bucket:`, error);
      process.exit(1);
    }
  }
}

createBucketIfNotExists()
  .then(() => {
    console.log('✅ S3 bucket setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ S3 bucket setup failed:', error);
    process.exit(1);
  });