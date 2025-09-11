"use client"

import { ThemeToggle } from "./ThemeToggle"

// AIDEV-NOTE: Force server-side rendering to prevent LlamaIndex static generation issues  
export const dynamic = 'force-dynamic';

export default function SystemSettingsPage() {
  return (
    <div className="flex justify-center items-center h-full">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h3 className="text-lg font-medium">System</h3>
          <p className="text-sm text-muted-foreground">
            Manage system-wide settings.
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Appearance</h4>
              <p className="text-sm text-muted-foreground">
                Toggle between light and dark mode.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  )
}
