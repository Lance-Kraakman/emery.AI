'use client';

import { useState } from 'react';
import { createRoleAction, deleteRole } from '@/app/actions/roles';

interface Role {
  id: number;
  name: string;
  permissions: string[] | null;
  createdAt: Date | null;
}

interface RoleManagerProps {
  roles: Role[];
}

const AVAILABLE_PERMISSIONS = [
  'read',
  'write',
  'delete',
  'manage_users',
  'manage_permissions',
  'create_database',
  'create_table',
  'manage_fields'
];

export default function RoleManager({ roles }: RoleManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const handlePermissionChange = (permission: string, checked: boolean) => {
    if (checked) {
      setSelectedPermissions([...selectedPermissions, permission]);
    } else {
      setSelectedPermissions(selectedPermissions.filter(p => p !== permission));
    }
  };

  const handleSubmit = async (formData: FormData) => {
    formData.set('permissions', selectedPermissions.join(','));
    await createRoleAction(formData);
    setSelectedPermissions([]);
    setIsCreating(false);
    window.location.reload();
  };

  return (
    <div className="border rounded p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Roles</h2>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
        >
          {isCreating ? 'Cancel' : 'Add Role'}
        </button>
      </div>

      {isCreating && (
        <form action={handleSubmit} className="mb-4 p-3 border rounded bg-gray-50">
          <div className="space-y-3">
            <input
              name="name"
              placeholder="Role name"
              required
              className="w-full p-2 border rounded"
            />
            <div>
              <label className="block text-sm font-medium mb-2">Permissions:</label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_PERMISSIONS.map((permission) => (
                  <label key={permission} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(permission)}
                      onChange={(e) => handlePermissionChange(permission, e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">{permission}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="bg-green-500 text-white px-3 py-1 rounded text-sm">
              Create
            </button>
            <button 
              type="button" 
              onClick={() => {
                setIsCreating(false);
                setSelectedPermissions([]);
              }}
              className="bg-gray-500 text-white px-3 py-1 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {roles.map((role) => (
          <div key={role.id} className="flex justify-between items-start p-2 border rounded">
            <div className="flex-1">
              <h3 className="font-medium">{role.name}</h3>
              {role.permissions && role.permissions.length > 0 && (
                <p className="text-xs text-gray-500">Permissions: {role.permissions.join(', ')}</p>
              )}
            </div>
            <button
              onClick={async () => {
                if (confirm('Delete this role?')) {
                  await deleteRole(role.id);
                  window.location.reload();
                }
              }}
              className="bg-red-500 text-white px-2 py-1 rounded text-xs"
            >
              Delete
            </button>
          </div>
        ))}
        {roles.length === 0 && (
          <p className="text-gray-500 text-center py-4">No roles found</p>
        )}
      </div>
    </div>
  );
}