'use client'

// Force dynamic rendering to prevent Html import issues during static generation
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Something went wrong!</h2>
        <button
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  )
}