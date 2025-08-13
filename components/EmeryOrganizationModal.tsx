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
import { Bot } from 'lucide-react'

export function EmeryOrganizationModal({ isCollapsed }: { isCollapsed?: boolean }) {
  const { data: session, update } = useSession()
  const [isOpen, setIsOpen] = React.useState(false)
  const [showCreateModal, setShowCreateModal] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  const currentOrg = session?.user?.currentOrganization
  const availableOrgs = session?.user?.availableOrganizations || []

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

  const handleCreateOrganization = async (formData: FormData) => {
    setIsLoading(true)
    try {
      await createOrganization(formData)
      await update()
      setShowCreateModal(false)
      setIsOpen(false)
      window.location.reload() // Refresh to show new org
    } catch (error) {
      console.error('Error creating organization:', error)
      alert('Failed to create organization')
    } finally {
      setIsLoading(false)
    }
  }

  if (!currentOrg) {
    return null
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {isCollapsed ? (
            <Button variant="ghost" size="icon">
              <Bot className="h-6 w-6" />
            </Button>
          ) : (
            <Button variant="ghost" className="w-full justify-start h-12 px-4">
              <Bot className="h-6 w-6 flex-shrink-0" />
              <div className="flex flex-col items-start ml-2 min-w-0 flex-1">
                <span className="truncate font-semibold text-sm">Emery.ai</span>
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
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
            </DialogHeader>
            <form action={handleCreateOrganization} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Organization Name *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="w-full p-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder="Enter organization name"
                />
              </div>
              <div>
                <label htmlFor="mission" className="block text-sm font-medium mb-1">
                  Mission (Optional)
                </label>
                <textarea
                  id="mission"
                  name="mission"
                  rows={3}
                  className="w-full p-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-ring"
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
