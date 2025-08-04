'use client';

import { useState } from 'react';
import { createWorkerAction, deleteWorker } from '@/app/actions/workers';

interface Worker {
  id: number;
  name: string;
  type: string;
  capabilities: string[] | null;
  status: string | null;
  createdAt: Date | null;
}

interface WorkerManagerProps {
  workers: Worker[];
}

export default function WorkerManager({ workers }: WorkerManagerProps) {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="border rounded p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Workers</h2>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
        >
          {isCreating ? 'Cancel' : 'Add Worker'}
        </button>
      </div>

      {isCreating && (
        <form action={createWorkerAction} className="mb-4 p-3 border rounded bg-gray-50">
          <div className="space-y-2">
            <input
              name="name"
              placeholder="Worker name"
              required
              className="w-full p-2 border rounded"
            />
            <select name="type" required className="w-full p-2 border rounded">
              <option value="">Select type</option>
              <option value="ai_agent">AI Agent</option>
              <option value="bot">Bot</option>
              <option value="automation">Automation</option>
              <option value="service">Service</option>
            </select>
            <select name="status" className="w-full p-2 border rounded">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <input
              name="capabilities"
              placeholder="Capabilities (comma-separated)"
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="bg-green-500 text-white px-3 py-1 rounded text-sm">
              Create
            </button>
            <button 
              type="button" 
              onClick={() => setIsCreating(false)}
              className="bg-gray-500 text-white px-3 py-1 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {workers.map((worker) => (
          <div key={worker.id} className="flex justify-between items-start p-2 border rounded">
            <div className="flex-1">
              <h3 className="font-medium">{worker.name}</h3>
              <p className="text-sm text-gray-600">
                {worker.type} • {worker.status || 'active'}
              </p>
              {worker.capabilities && worker.capabilities.length > 0 && (
                <p className="text-xs text-gray-500">Capabilities: {worker.capabilities.join(', ')}</p>
              )}
            </div>
            <button
              onClick={async () => {
                if (confirm('Delete this worker?')) {
                  await deleteWorker(worker.id);
                  window.location.reload();
                }
              }}
              className="bg-red-500 text-white px-2 py-1 rounded text-xs"
            >
              Delete
            </button>
          </div>
        ))}
        {workers.length === 0 && (
          <p className="text-gray-500 text-center py-4">No workers found</p>
        )}
      </div>
    </div>
  );
}