import { NextRequest } from 'next/server';
import { ApiKey, UserId } from '@/ddd/domain/shared/value-objects';
import { getOAuthProxyApplicationService, getUserRepository, getAgentRepository } from '@/ddd/application/di/container';

/**
 * Unified OAuth Proxy - Supports both agent and user API keys
 *
 * SECURITY: API key mode is determined server-side based on which lookup succeeds.
 * Client cannot specify mode to prevent privilege escalation.
 *
 * Usage: POST /api/connections/proxy
 * Headers: Authorization: Bearer {api_key}
 * Body: {
 *   "service": "gmail",
 *   "action": "send_email",
 *   "params": {...}
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

    // Parse request body - SECURITY: api_key_mode is validated against server-determined mode
    const { service, action, params, api_key_mode } = await request.json();

    if (!service || !action) {
      return Response.json({
        error: 'Missing required fields: service, action'
      }, { status: 400 });
    }

    // Get services from DI container
    const oauthProxyService = getOAuthProxyApplicationService();
    const userRepository = getUserRepository();
    const agentRepository = getAgentRepository();

    const apiKey = ApiKey.fromString(apiKeyValue);
    let result;

    // SECURITY: Server determines API key type by attempting lookups
    // Try user key first, then agent key
    const user = await userRepository.findByApiKey(apiKey);

    if (user) {
      // SECURITY: Validate that client-claimed mode matches server-determined mode
      if (api_key_mode && api_key_mode !== 'user') {
        return Response.json({
          error: 'API key mode mismatch: key is a user key but client claimed agent mode'
        }, { status: 403 });
      }

      result = await oauthProxyService.executeUserOAuthCall(
        user.id,
        { service, action, params, api_key_mode: 'user' }
      );
    } else {
      // Try agent key lookup
      const agent = await agentRepository.findByApiKey(apiKey);

      if (!agent) {
        return Response.json({ error: 'Invalid API key' }, { status: 401 });
      }

      // SECURITY: Validate that client-claimed mode matches server-determined mode
      if (api_key_mode && api_key_mode !== 'agent') {
        return Response.json({
          error: 'API key mode mismatch: key is an agent key but client claimed user mode'
        }, { status: 403 });
      }

      result = await oauthProxyService.executeAgentOAuthCall(
        apiKey,
        { service, action, params, api_key_mode: 'agent' }
      );
    }

    if (result.success) {
      return Response.json(result.data);
    } else {
      const statusCode = result.error?.includes('Invalid API key') ? 401 : 500;
      return Response.json({ success: false, error: result.error }, { status: statusCode });
    }

  } catch (error) {
    console.error('[PROXY] OAuth proxy error:', error);
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
