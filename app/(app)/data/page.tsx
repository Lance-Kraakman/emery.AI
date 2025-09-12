import { Suspense } from "react"
import { CanvasRenderer } from "@/components/canvas/CanvasRenderer"
import { DataCanvas } from "@/components/canvas"
import { DataViewsClientSimplified } from "./DataViewsClient-simplified"
import { Loading } from "@/components/ui/loading"

export default function DataViewsPage() {
  console.log('DataViewsPage rendering')
  return (
    <CanvasRenderer
      fallbackContent={
        <div>
          <h1>Fallback Content Test</h1>
          <DataCanvas>
            <Suspense fallback={<Loading text="Loading data views..." />}>
              <DataViewsClientSimplified />
            </Suspense>
          </DataCanvas>
        </div>
      }
    />
  )
}