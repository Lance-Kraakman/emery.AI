import React, { Suspense } from "react"
import { DataPage } from "@/components/canvas"
import { DataViewsClientSimplified } from "./DataViewsClient-simplified"
import { Loading } from "@/components/ui/loading"

export default function DataViewsPage() {
  return (
    <DataPage>
      <Suspense fallback={<Loading text="Loading data views..." />}>
        <DataViewsClientSimplified />
      </Suspense>
    </DataPage>
  )
}