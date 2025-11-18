// AIDEV-NOTE: Public page renderer for published Puck pages
// Implements authentication checks for protected pages

import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getPublicApp, getPublicPage, checkPageAccess } from "@/app/actions/public-pages"
import { PublicPageRenderer } from "./PublicPageRenderer"
import { auth } from "@/lib/auth"

interface PublicPageProps {
  params: Promise<{
    orgSlug: string
    appSlug: string
    pageSlug: string
  }>
}

export async function generateMetadata({
  params
}: PublicPageProps): Promise<Metadata> {
  const { orgSlug, appSlug, pageSlug } = await params

  const pageResult = await getPublicPage(
    orgSlug,
    appSlug,
    pageSlug
  )

  if (!pageResult.success || !pageResult.data) {
    return {
      title: "Page Not Found"
    }
  }

  const page = pageResult.data

  return {
    title: page.name,
    description: page.description || undefined
  }
}

export default async function PublicPage({ params }: PublicPageProps) {
  const { orgSlug, appSlug, pageSlug } = await params

  // Fetch app and page data
  const [appResult, pageResult] = await Promise.all([
    getPublicApp(orgSlug, appSlug),
    getPublicPage(orgSlug, appSlug, pageSlug)
  ])

  if (!appResult.success || !appResult.data || !pageResult.success || !pageResult.data) {
    notFound()
  }

  const app = appResult.data
  const page = pageResult.data

  // Check authentication and access control
  const session = await auth()
  const accessCheck = await checkPageAccess(
    page.id,
    session?.user?.id || null
  )

  if (!accessCheck.allowed) {
    if (accessCheck.redirectToLogin) {
      // Save requested URL for post-login redirect
      const callbackUrl = `/public/${orgSlug}/${appSlug}/${pageSlug}`
      redirect(`/public/${orgSlug}/${appSlug}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
    } else {
      // User is authenticated but doesn't have required permissions
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md p-8">
            <h1 className="text-3xl font-bold mb-4 text-gray-900">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              {accessCheck.reason || "You don't have permission to view this page."}
            </p>
            <a
              href={`/public/${orgSlug}/${appSlug}`}
              className="text-blue-600 hover:text-blue-500 underline"
            >
              Back to app
            </a>
          </div>
        </div>
      )
    }
  }

  return (
    <PublicPageRenderer
      page={page}
      app={app}
    />
  )
}
