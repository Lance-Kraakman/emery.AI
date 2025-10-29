import React, { Suspense } from "react"
import { DataViewsClientSimplified } from "./DataViewsClient-simplified"
import { Loading } from "@/components/ui/loading"
import { DataPage } from "./DataPage"

export default function DataViewsPage() {
  return (
    <DataPage>
      <Suspense fallback={<Loading text="Loading data views..." />}>
        <DataViewsClientSimplified />
      </Suspense>
    </DataPage>
  )
}