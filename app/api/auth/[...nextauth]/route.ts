// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

import NextAuth from "@/lib/auth"

const handler = NextAuth

export { handler as GET, handler as POST }