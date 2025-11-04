import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { ChatProcessingClient } from '@/lib/grpc/chat-processing-client';

/**
 * POST /api/chat/cancel
 *
 * Cancel an in-progress chat message by calling the gRPC cancellation service.
 *
 * Request body:
 * - messageId: string - The message ID to cancel
 *
 * Response:
 * - success: boolean
 * - message: string
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const organizationId = session.user.currentOrganizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization context' },
        { status: 400 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    console.log(`[CHAT-CANCEL-API] Cancelling message ${messageId} for user ${userId}`);

    // 3. Call gRPC cancellation service
    const chatClient = new ChatProcessingClient(userId, organizationId);

    try {
      const result = await chatClient.cancelMessage(
        messageId,
        userId,
        organizationId
      );

      console.log(`[CHAT-CANCEL-API] Cancellation result:`, result);

      return NextResponse.json({
        success: result.success,
        message: result.message
      });

    } catch (grpcError) {
      console.error(`[CHAT-CANCEL-API] gRPC error:`, grpcError);

      return NextResponse.json({
        success: false,
        message: 'Failed to cancel message via gRPC'
      }, { status: 500 });

    } finally {
      chatClient.close();
    }

  } catch (error) {
    console.error('[CHAT-CANCEL-API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
