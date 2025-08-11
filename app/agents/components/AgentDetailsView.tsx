'use client';

import { useState } from 'react';
import { Agent } from '@/types/db';
import CapabilityManager from './CapabilityManager';
import AgentActivityPanel from './AgentActivityPanel';

interface AgentDetailsViewProps {
  agent: Agent;
  onEdit: () => void;
}

export default function AgentDetailsView({ agent, onEdit }: AgentDetailsViewProps) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="text-foreground">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">{agent.name}</h2>
        <button
          onClick={onEdit}
          className="bg-secondary text-secondary-foreground px-3 py-1 rounded text-sm hover:bg-muted"
        >
          Edit
        </button>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('capabilities')}
            className={`${
              activeTab === 'capabilities'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Capabilities
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`${
              activeTab === 'activity'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Activity
          </button>
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-foreground">Role</h3>
              <p className="text-muted-foreground">{agent.role}</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">Description</h3>
              <p className="text-muted-foreground">{agent.description}</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">Persona</h3>
              <p className="text-muted-foreground">{agent.persona}</p>
            </div>
          </div>
        )}
        {activeTab === 'capabilities' && (
          <CapabilityManager agent={agent} />
        )}
        {activeTab === 'activity' && (
          <AgentActivityPanel agent={agent} />
        )}
      </div>
    </div>
  );
}
