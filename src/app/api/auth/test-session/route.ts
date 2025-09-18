import { NextRequest } from 'next/server'
import { auth } from '@/src/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    
    console.log('[AUTH-TEST] Session debug:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      currentOrganizationId: session?.user?.currentOrganizationId,
      cookies: req.cookies.getAll(),
      headers: Object.fromEntries(req.headers.entries())
    })
    
    return Response.json({
      authenticated: !!session?.user?.id,
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        currentOrganizationId: session.user.currentOrganizationId
      } : null,
      session: !!session
    })
  } catch (error) {
    console.error('[AUTH-TEST] Error:', error)
    return Response.json({ error: 'Auth test failed', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}