import { NextRequest } from 'next/server';
import { ApiKey, UserId } from '@/ddd/domain/shared/value-objects';
import { getOAuthProxyApplicationService, getUserRepository } from '@/ddd/application/di/container';

/**
 * Unified OAuth Proxy - Supports both agent and user API keys
 *
 * Usage: POST /api/connections/proxy
 * Headers: Authorization: Bearer {api_key}
 * Body: {
 *   "service": "gmail",
 *   "action": "send_email",
 *   "params": {...},
 *   "api_key_mode": "user" | "agent"  // defaults to "agent"
 * }
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization');
    const apiKeyValue = authHeader?.replace('Bearer ', '');

    if (!apiKeyValue) {
      return Response.json({ error: 'Missing API key' }, { status: 401 });
    }

    // Parse request body
    const { service, action, params, api_key_mode = 'agent' } = await request.json();

    if (!service || !action) {
      return Response.json({
        error: 'Missing required fields: service, action'
      }, { status: 400 });
    }

    // Get OAuth proxy service from DI container
    const oauthProxyService = getOAuthProxyApplicationService();

    let result;

    if (api_key_mode === 'user') {
      // User mode: Look up user by API key and use their credentials
      const userRepository = getUserRepository();

      const userApiKey = ApiKey.fromString(apiKeyValue);
      const user = await userRepository.findByApiKey(userApiKey);

      if (!user) {
        return Response.json({ error: 'Invalid user API key' }, { status: 401 });
      }

      result = await oauthProxyService.executeUserOAuthCall(
        user.id,
        { service, action, params, api_key_mode }
      );
    } else {
      // Agent mode: Look up agent by API key and use owner's credentials
      const apiKey = ApiKey.fromString(apiKeyValue);

      result = await oauthProxyService.executeAgentOAuthCall(
        apiKey,
        { service, action, params, api_key_mode }
      );
    }

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
