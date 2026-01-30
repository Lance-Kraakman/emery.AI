'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { switchCurrentOrganization } from '@/app/actions/user-organizations'
import { createOrganization } from '@/app/actions/setup'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
export function EmeryOrganizationModal({ isCollapsed }: { isCollapsed?: boolean }) {
  const { data: session, update } = useSession()
  const [isOpen, setIsOpen] = React.useState(false)
  const [showCreateModal, setShowCreateModal] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [orgName, setOrgName] = React.useState('')
  const [orgSlug, setOrgSlug] = React.useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(false)

  const currentOrg = session?.user?.currentOrganization
  const availableOrgs = session?.user?.availableOrganizations || []

  // Auto-generate slug from name (unless manually edited)
  React.useEffect(() => {
    if (!slugManuallyEdited && orgName) {
      const autoSlug = orgName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-')          // Spaces to hyphens
        .replace(/-+/g, '-')           // Multiple hyphens to single
        .replace(/^-|-$/g, '')         // Trim hyphens
        .slice(0, 50);                 // Max length
      setOrgSlug(autoSlug);
    }
  }, [orgName, slugManuallyEdited]);

  const handleSwitchOrganization = async (orgId: number) => {
    if (orgId === currentOrg?.id) {
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    try {
      const result = await switchCurrentOrganization(orgId)
      if (result.success) {
        await update()
        setIsOpen(false)
        window.location.reload() // Refresh to update sidebar data
      } else {
        alert(`Failed to switch organization: ${result.error}`)
      }
    } catch (error) {
      console.error('Error switching organization:', error)
      alert('Failed to switch organization')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateOrganization = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setCreateError(null) // Clear previous errors

    // Client-side validation
    if (!orgName.trim()) {
      setCreateError('Organization name is required')
      setIsLoading(false)
      return
    }

    if (!orgSlug.trim()) {
      setCreateError('Organization slug is required')
      setIsLoading(false)
      return
    }

    if (!/^[a-z0-9-]+$/.test(orgSlug)) {
      setCreateError('Slug can only contain lowercase letters, numbers, and hyphens')
      setIsLoading(false)
      return
    }

    if (orgSlug.length < 2) {
      setCreateError('Slug must be at least 2 characters')
      setIsLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append('organizationName', orgName)
      formData.append('organizationSlug', orgSlug)
      formData.append('organizationMission', (document.getElementById('organizationMission') as HTMLTextAreaElement)?.value || '')

      const result = await createOrganization(formData)

      if (result.success) {
        await update()
        setShowCreateModal(false)
        setIsOpen(false)
        // Reset form state
        setOrgName('')
        setOrgSlug('')
        setSlugManuallyEdited(false)
        // Redirect to billing page with welcome banner for new organizations
        window.location.href = '/settings/billing?welcome=true'
      } else {
        setCreateError(result.error || 'Failed to create organization')
      }
    } catch (error) {
      console.error('Error creating organization:', error)
      setCreateError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSlugChange = (value: string) => {
    // Auto-format: lowercase, allow only valid characters
    const formatted = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 50);
    setOrgSlug(formatted);
    setSlugManuallyEdited(true);
  }

  if (!currentOrg) {
    return null
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {isCollapsed ? (
            <Button variant="ghost" size="icon" className="h-12 w-12">
              <img src="/assets/braintable/logo_logo.png" alt="Braintable" className="h-6 w-6" />
            </Button>
          ) : (
            <Button variant="ghost" className="w-full justify-start h-12 px-4">
              <div className="flex flex-col items-start min-w-0 flex-1">
                <img src="/assets/braintable/text_only_logo.png" alt="Braintable" className="h-5 mb-1" />
                <span className="truncate text-xs text-muted-foreground">{currentOrg.name}</span>
              </div>
            </Button>
          )}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch Organization</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {availableOrgs.map((org) => (
              <Button
                key={org.id}
                variant={org.id === currentOrg?.id ? 'default' : 'outline'}
                onClick={() => handleSwitchOrganization(org.id)}
                disabled={isLoading}
              >
                {org.name}
              </Button>
            ))}
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(true)}
              disabled={isLoading}
              className="border-dashed"
            >
              + Create Organization
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Organization Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={(open) => {
          setShowCreateModal(open)
          if (!open) {
            // Clear all form state when closing
            setCreateError(null)
            setOrgName('')
            setOrgSlug('')
            setSlugManuallyEdited(false)
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
            </DialogHeader>
            {createError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div>
                <label htmlFor="organizationName" className="block text-sm font-medium mb-1">
                  Organization Name *
                </label>
                <input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full p-2 border border-input bg-background rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                  placeholder="e.g., Acme Corporation"
                />
              </div>

              <div>
                <label htmlFor="organizationSlug" className="block text-sm font-medium mb-1">
                  Organization Slug *
                </label>
                <input
                  id="organizationSlug"
                  name="organizationSlug"
                  type="text"
                  required
                  value={orgSlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className="w-full p-2 border border-input bg-background rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring font-mono text-sm"
                  placeholder="e.g., acme-corp"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Used in URLs: /public/<span className="font-mono font-semibold">{orgSlug || 'your-slug'}</span>/...
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Only lowercase letters, numbers, and hyphens allowed
                </p>
              </div>

              <div>
                <label htmlFor="organizationMission" className="block text-sm font-medium mb-1">
                  Mission (Optional)
                </label>
                <textarea
                  id="organizationMission"
                  name="organizationMission"
                  rows={3}
                  className="w-full p-2 border border-input bg-background rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                  placeholder="Organization mission or description"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? 'Creating...' : 'Create'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
