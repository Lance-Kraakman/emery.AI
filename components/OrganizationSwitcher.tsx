'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { switchCurrentOrganization } from '@/app/actions/user-organizations';
import { createOrganizationAction } from '@/app/actions/organizations';

interface Organization {
  id: number;
  name: string;
  userRole: string;
  mission?: string;
}

export default function OrganizationSwitcher() {
  const { data: session, update } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOrg = session?.user?.currentOrganization;
  const availableOrgs = session?.user?.availableOrganizations || [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSwitchOrganization = async (orgId: number) => {
    if (orgId === currentOrg?.id) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await switchCurrentOrganization(orgId);
      if (result.success) {
        // Refresh the session to get updated organization data
        await update();
        setIsOpen(false);
      } else {
        alert(`Failed to switch organization: ${result.error}`);
      }
    } catch (error) {
      console.error('Error switching organization:', error);
      alert('Failed to switch organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrganization = async (formData: FormData) => {
    setIsLoading(true);
    try {
      await createOrganizationAction(formData);
      await update(); // Refresh session
      setShowCreateModal(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Error creating organization:', error);
      alert('Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  };

  if (!session?.user) {
    return null;
  }

  // Show current organization name or default
  const displayName = currentOrg?.name || 'Select Organization';

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <span className="text-xl">🗂️</span>
          <span className="hidden sm:block">{displayName}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Organizations</p>
            </div>

            {availableOrgs.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitchOrganization(org.id)}
                disabled={isLoading}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between disabled:opacity-50 ${
                  org.id === currentOrg?.id ? 'bg-blue-50 text-blue-700' : ''
                }`}
              >
                <div>
                  <p className="font-medium text-sm">{org.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{org.userRole}</p>
                </div>
                {org.id === currentOrg?.id && (
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}

            <div className="border-t border-gray-100 px-3 py-2">
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={isLoading}
                className="w-full text-left px-0 py-1 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                + Create Organization
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Create New Organization</h2>
            <form action={handleCreateOrganization}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name *
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter organization name"
                  />
                </div>
                <div>
                  <label htmlFor="mission" className="block text-sm font-medium text-gray-700 mb-1">
                    Mission (Optional)
                  </label>
                  <textarea
                    id="mission"
                    name="mission"
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Organization mission or description"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isLoading}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}