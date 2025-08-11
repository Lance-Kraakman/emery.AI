'use client';

import { useState } from 'react';
import { Agent } from '@/types/db';
import CapabilityFormDialog from './CapabilityFormDialog';

interface CapabilityManagerProps {
  agent: Agent;
}

export default function CapabilityManager({ agent }: CapabilityManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const capabilities = agent.capabilities as any[] || [];

  return (
    <div className="text-foreground">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Capabilities</h3>
        <button
          onClick={() => setIsFormOpen(true)}
          className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm hover:bg-primary/90"
        >
          Add Capability
        </button>
      </div>
      <div className="space-y-4">
        {capabilities.length > 0 ? (
          capabilities.map((cap, index) => (
            <div key={index} className="p-4 border rounded-lg bg-card">
              <h4 className="font-semibold text-foreground">{cap.name}</h4>
              <p className="text-sm text-muted-foreground">{cap.description}</p>
              <div className="mt-2">
                <h5 className="text-xs font-semibold text-muted-foreground">Tools</h5>
                <div className="flex flex-wrap gap-2 mt-1">
                  {cap.tools?.map((tool: string) => (
                    <span key={tool} className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-2">
                <h5 className="text-xs font-semibold text-muted-foreground">Servers</h5>
                <div className="flex flex-wrap gap-2 mt-1">
                  {cap.servers?.map((server: any) => (
                    <span key={server.name} className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                      {server.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No capabilities configured for this agent.</p>
        )}
      </div>
      <CapabilityFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        agent={agent}
      />
    </div>
  );
}
