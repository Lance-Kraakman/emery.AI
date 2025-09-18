import { NextRequest } from 'next/server';
import { auth } from '@/src/lib/auth';
import { workerRegistry } from '@/src/lib/grpc/client';

/**
 * Debug endpoint for worker service discovery
 * Shows available worker addresses and health status
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const session = await auth();

    // Get worker discovery information
    const addresses = workerRegistry.listWorkerAddresses();
    
    // Test health for common organizations
    const healthChecks: Record<string, any> = {};
    const testOrgs = ['default', 'test_org'];
    
    for (const orgId of testOrgs) {
      try {
        const health = await workerRegistry.getWorkerHealth(orgId);
        healthChecks[orgId] = {
          status: 'healthy',
          worker_info: health,
        };
      } catch (error) {
        healthChecks[orgId] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return Response.json({
      success: true,
      worker_discovery: {
        addresses,
        health_checks: healthChecks,
        environment_variables: {
          WORKER_ADDRESS: process.env.WORKER_ADDRESS || null,
          WORKER_HOST: process.env.WORKER_HOST || 'localhost',
          WORKER_BASE_PORT: process.env.WORKER_BASE_PORT || '50051',
        },
      },
    });

  } catch (error) {
    console.error('Error in worker discovery:', error);
    return Response.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}