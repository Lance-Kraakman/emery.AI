'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Simplified ChatPlusButton - Temporary stub for the new system
 * 
 * AIDEV-NOTE: This is a temporary simplified version while we transition
 * to the new reference system. The old complex TanStack Store version
 * has been moved to deprecated.
 */

interface ChatPlusButtonProps {
  onItemInsert?: (text: string) => void
}

export function ChatPlusButton({ onItemInsert }: ChatPlusButtonProps) {
  // For now, just render a disabled button
  // This can be enhanced later with the new simple reference system
  
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8"
      disabled
      title="Reference insertion (coming soon with simplified system)"
    >
      <Plus className="h-4 w-4" />
    </Button>
  )
}