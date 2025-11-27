import React, { Suspense } from "react"
import { DataViewsClientSimplified } from "../DataViewsClient-simplified"
import { Loading } from "@/components/ui/loading"
import { DataPage } from "../DataPage"

interface TablePageProps {
  params: Promise<{ id: string }>
}

export default async function TablePage({ params }: TablePageProps) {
  const { id } = await params
  const tableId = parseInt(id)

  if (isNaN(tableId)) {
    return (
      <DataPage>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Table ID</h2>
            <p className="text-gray-600">The table ID must be a valid number.</p>
          </div>
        </div>
      </DataPage>
    )
  }

  return (
    <DataPage>
      <Suspense fallback={<Loading text="Loading table..." />}>
        <DataViewsClientSimplified tableId={tableId} />
      </Suspense>
    </DataPage>
  )
}
