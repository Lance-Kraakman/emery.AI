import { Suspense } from "react"
import { CanvasRenderer } from "@/components/canvas/CanvasRenderer"
import { DataCanvas } from "@/components/canvas"
import { DataViewsClientSimplified } from "./DataViewsClient-simplified"
import { Loading } from "@/components/ui/loading"

export default function DataViewsPage() {
  return (
    <CanvasRenderer
      fallbackContent={
        <DataCanvas>
          <Suspense fallback={<Loading text="Loading data views..." />}>
            <DataViewsClientSimplified />
          </Suspense>
        </DataCanvas>
      }
    />
  )
}