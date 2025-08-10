import { Suspense } from "react"
import { DataViewsClientHierarchical } from "./DataViewsClient-hierarchical"
import { Loader2 } from "lucide-react"

export default function DataViewsPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading data views...</span>
        </div>
      </div>
    }>
      <DataViewsClientHierarchical />
    </Suspense>
  )
}