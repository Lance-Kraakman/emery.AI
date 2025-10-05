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

    console.log('[PROXY] Incoming OAuth proxy request');
    console.log('[PROXY] Auth header present:', !!authHeader);

    if (!apiKeyValue) {
      console.log('[PROXY] ERROR: Missing API key');
      return Response.json({ error: 'Missing API key' }, { status: 401 });
    }

    // Parse request body
    const { service, action, params, api_key_mode = 'agent' } = await request.json();

    console.log('[PROXY] Request details:', {
      service,
      action,
      api_key_mode,
      params_keys: params ? Object.keys(params) : []
    });

    if (!service || !action) {
      console.log('[PROXY] ERROR: Missing service or action');
      return Response.json({
        error: 'Missing required fields: service, action'
      }, { status: 400 });
    }

    // Get OAuth proxy service from DI container
    const oauthProxyService = getOAuthProxyApplicationService();

    let result;

    if (api_key_mode === 'user') {
      console.log('[PROXY] Using USER mode - looking up user by API key');

      // User mode: Look up user by API key and use their credentials
      const userRepository = getUserRepository();

      const userApiKey = ApiKey.fromString(apiKeyValue);
      const user = await userRepository.findByApiKey(userApiKey);

      if (!user) {
        console.log('[PROXY] ERROR: Invalid user API key');
        return Response.json({ error: 'Invalid user API key' }, { status: 401 });
      }

      console.log('[PROXY] Found user:', {
        userId: user.id.value,
        email: user.email?.value || 'no-email'
      });

      console.log('[PROXY] Calling executeUserOAuthCall...');
      result = await oauthProxyService.executeUserOAuthCall(
        user.id,
        { service, action, params, api_key_mode }
      );
      console.log('[PROXY] User OAuth call result:', {
        success: result.success,
        error: result.error,
        hasData: !!result.data
      });
    } else {
      console.log('[PROXY] Using AGENT mode - looking up agent by API key');

      // Agent mode: Look up agent by API key and use owner's credentials
      const apiKey = ApiKey.fromString(apiKeyValue);

      console.log('[PROXY] Calling executeAgentOAuthCall...');
      result = await oauthProxyService.executeAgentOAuthCall(
        apiKey,
        { service, action, params, api_key_mode }
      );
      console.log('[PROXY] Agent OAuth call result:', {
        success: result.success,
        error: result.error,
        hasData: !!result.data
      });
    }

    if (result.success) {
      console.log('[PROXY] SUCCESS - Returning data to client');
      return Response.json(result.data);
    } else {
      console.log('[PROXY] FAILURE - Error from OAuth service:', result.error);
      // Determine appropriate status code based on error
      const statusCode = result.error?.includes('Invalid API key') ? 401 : 500;
      return Response.json({ success: false, error: result.error }, { status: statusCode });
    }

  } catch (error) {
    console.error('[PROXY] EXCEPTION in OAuth proxy route:', error);
    console.error('[PROXY] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
