import { NextRequest } from 'next/server';
import { ApiKey } from '@/ddd/domain/shared/value-objects';
import { getOAuthProxyApplicationService } from '@/ddd/application/di/container';

/**
 * Universal OAuth Proxy - Single endpoint for all agent OAuth calls
 *
 * Usage: POST /api/agents/proxy
 * Headers: Authorization: Bearer {agent_api_key}
 * Body: { "service": "gmail", "action": "send_email", "params": {...} }
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization');
    const apiKeyValue = authHeader?.replace('Bearer ', '');

    if (!apiKeyValue) {
      return Response.json({ error: 'Missing API key' }, { status: 401 });
    }

    // Create API key value object
    let apiKey: ApiKey;
    try {
      apiKey = ApiKey.fromString(apiKeyValue);
    } catch (error) {
      return Response.json({ error: 'Invalid API key format' }, { status: 401 });
    }

    // Parse request body
    const { service, action, params } = await request.json();

    if (!service || !action) {
      return Response.json({
        error: 'Missing required fields: service, action'
      }, { status: 400 });
    }

    // Get OAuth proxy service from DI container
    const oauthProxyService = getOAuthProxyApplicationService();

    // Execute OAuth call via application service
    const result = await oauthProxyService.executeAgentOAuthCall(
      apiKey,
      { service, action, params }
    );

    if (result.success) {
      return Response.json(result.data);
    } else {
      // Determine appropriate status code based on error
      const statusCode = result.error?.includes('Invalid API key') ? 401 : 500;
      return Response.json({ success: false, error: result.error }, { status: statusCode });
    }

  } catch (error) {
    console.error('OAuth proxy route error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

