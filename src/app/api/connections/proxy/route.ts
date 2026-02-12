import { NextRequest } from 'next/server';
import { getOAuthProxyApplicationService } from '@/ddd/application/di/container';
import { validateToken, TokenType, getTokenTypeFromPrefix } from '@/lib/auth/token-service';
import { UserId } from '@/ddd/domain/shared/value-objects';

/**
 * Unified OAuth Proxy - Supports user and agent API tokens
 *
 * SECURITY: Token type is determined by the unified token system.
 * Supports: user_*, agent_*, device_*, cb_* tokens
 *
 * Usage: POST /api/connections/proxy
 * Headers: Authorization: Bearer {api_token}
 * Body: {
 *   "service": "gmail",
 *   "action": "send_email",
 *   "params": {...}
 * }
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Extract API token from Authorization header
    const authHeader = request.headers.get('authorization');
    const tokenValue = authHeader?.replace('Bearer ', '');

    if (!tokenValue) {
      return Response.json({ error: 'Missing API token' }, { status: 401 });
    }

    // Parse request body - SECURITY: api_key_mode is validated against server-determined mode
    const { service, action, params, api_key_mode } = await request.json();

    if (!service || !action) {
      return Response.json({
        error: 'Missing required fields: service, action'
      }, { status: 400 });
    }

    // Validate token using unified token service
    const validatedToken = await validateToken(tokenValue, ['oauth:proxy']);

    if (!validatedToken) {
      return Response.json({ error: 'Invalid API token' }, { status: 401 });
    }

    const oauthProxyService = getOAuthProxyApplicationService();
    let result;

    // Determine token type from prefix
    const tokenType = getTokenTypeFromPrefix(tokenValue);
    const isAgentToken = tokenType === TokenType.AGENT_API;

    if (isAgentToken && validatedToken.agentId) {
      // Agent token - use agent's owner for OAuth
      if (api_key_mode && api_key_mode !== 'agent') {
        return Response.json({
          error: 'API key mode mismatch: key is an agent key but client claimed user mode'
        }, { status: 403 });
      }

      result = await oauthProxyService.executeAgentOAuthCallByAgentId(
        validatedToken.agentId,
        { service, action, params, api_key_mode: 'agent' }
      );
    } else if (validatedToken.userId) {
      // User token (user_*, device_*, cb_*)
      if (api_key_mode && api_key_mode !== 'user') {
        return Response.json({
          error: 'API key mode mismatch: key is a user key but client claimed agent mode'
        }, { status: 403 });
      }

      result = await oauthProxyService.executeUserOAuthCall(
        UserId.fromString(validatedToken.userId),
        { service, action, params, api_key_mode: 'user' }
      );
    } else {
      return Response.json({ error: 'Invalid token: no user or agent associated' }, { status: 401 });
    }

    if (result.success) {
      return Response.json(result.data);
    } else {
      const statusCode = result.error?.includes('Invalid') ? 401 : 500;
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
