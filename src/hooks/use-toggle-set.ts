import { useState } from "react"

export function useToggleSet<T>(initialSet: Set<T> = new Set()) {
  const [openSet, setOpenSet] = useState<Set<T>>(initialSet)

  const toggle = (item: T) => {
    setOpenSet((prev) => {
      const next = new Set(prev)
      if (next.has(item)) {
        next.delete(item)
      } else {
        next.add(item)
      }
      return next
    })
  }

  const isOpen = (item: T) => openSet.has(item)

  return { openSet, toggle, isOpen }
}
