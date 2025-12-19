import { auth } from '@/lib/auth'

export async function GET() {
  try {
    const session = await auth()

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
    return Response.json({ error: 'Auth test failed' }, { status: 500 })
  }
}