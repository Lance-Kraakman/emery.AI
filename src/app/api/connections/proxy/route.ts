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

    console.log('[PROXY] Incoming OAuth proxy request');
    console.log('[PROXY] Auth header present:', !!authHeader);

    if (!apiKeyValue) {
      console.log('[PROXY] ERROR: Missing API key');
      return Response.json({ error: 'Missing API key' }, { status: 401 });
    }

    // Parse request body - SECURITY: api_key_mode is validated against server-determined mode
    const { service, action, params, api_key_mode } = await request.json();

    console.log('[PROXY] Request details:', {
      service,
      action,
      params_keys: params ? Object.keys(params) : []
    });

    if (!service || !action) {
      console.log('[PROXY] ERROR: Missing service or action');
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
      console.log('[PROXY] Authenticated as USER:', {
        userId: user.id.value,
        email: user.email?.value || 'no-email'
      });

      // SECURITY: Validate that client-claimed mode matches server-determined mode
      if (api_key_mode && api_key_mode !== 'user') {
        console.warn('[PROXY] Mode mismatch - client claimed:', api_key_mode,
                     'but server determined: user. Possible misconfiguration or attack.');
        return Response.json({
          error: 'API key mode mismatch: key is a user key but client claimed agent mode'
        }, { status: 403 });
      }

      console.log('[PROXY] Calling executeUserOAuthCall...');
      result = await oauthProxyService.executeUserOAuthCall(
        user.id,
        { service, action, params, api_key_mode: 'user' }
      );
      console.log('[PROXY] User OAuth call result:', {
        success: result.success,
        error: result.error,
        hasData: !!result.data
      });
    } else {
      // Try agent key lookup
      const agent = await agentRepository.findByApiKey(apiKey);

      if (!agent) {
        console.log('[PROXY] ERROR: Invalid API key - not found as user or agent key');
        return Response.json({ error: 'Invalid API key' }, { status: 401 });
      }

      console.log('[PROXY] Authenticated as AGENT:', agent.id.value);

      // SECURITY: Validate that client-claimed mode matches server-determined mode
      if (api_key_mode && api_key_mode !== 'agent') {
        console.warn('[PROXY] Mode mismatch - client claimed:', api_key_mode,
                     'but server determined: agent. Possible misconfiguration or attack.');
        return Response.json({
          error: 'API key mode mismatch: key is an agent key but client claimed user mode'
        }, { status: 403 });
      }

      console.log('[PROXY] Calling executeAgentOAuthCall...');
      result = await oauthProxyService.executeAgentOAuthCall(
        apiKey,
        { service, action, params, api_key_mode: 'agent' }
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
