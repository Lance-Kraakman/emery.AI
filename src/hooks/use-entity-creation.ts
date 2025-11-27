import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export interface ActionResult<T> {
  success: boolean
  data?: T
  error?: string
}

interface EntityCreationOptions {
  successMessage: string
  errorMessage?: string
  navigateTo?: string
  shouldRefresh?: boolean
}

export function useEntityCreation<T>(
  action: () => Promise<ActionResult<T>>,
  options: EntityCreationOptions
) {
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const result = await action()
      if (result.success) {
        toast.success(options.successMessage)
        if (options.navigateTo) {
          router.push(options.navigateTo)
        }
        if (options.shouldRefresh) {
          router.refresh()
        }
      } else {
        toast.error(result.error || options.errorMessage || "Operation failed")
      }
    } catch (error) {
      toast.error(options.errorMessage || "Operation failed")
    } finally {
      setIsCreating(false)
    }
  }

  return { handleCreate, isCreating }
}
