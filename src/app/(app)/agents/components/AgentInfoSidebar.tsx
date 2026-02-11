'use client';

import React from 'react';
import { User, Edit3, Settings } from 'lucide-react';
import type { AgentDTO } from '@/app/dtos/agent.dto';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import type { ConnectionDTO } from '@/app/mappers/connection-mapper';
import { CompactSkillsList } from './CompactSkillsList';
import { CompactConnectionsList } from './CompactConnectionsList';
import { CompactSchedulesList } from './CompactSchedulesList';
import { useModal } from './modals/ModalContext';

interface AgentInfoSidebarProps {
  agent: AgentDTO;
  skills: SkillDTO[];
  connections: ConnectionDTO[];
  className?: string;
}

const STATUS_COLORS = {
  active: 'bg-green-500/20 text-green-600 border-green-500/30',
  inactive: 'bg-gray-500/20 text-gray-600 border-gray-500/30',
  archived: 'bg-red-500/20 text-red-600 border-red-500/30',
};

export function AgentInfoSidebar({
  agent,
  skills,
  connections,
  className = ''
}: AgentInfoSidebarProps) {
  const { openModal } = useModal();

  const handleEditBasicInfo = () => {
    openModal('basic-info', { agent });
  };

  const handleManageSchedules = () => {
    openModal('trigger-config', { agent });
  };

  const handleManageConnections = () => {
    openModal('authorized-connections', { agent });
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      {/* Agent Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{agent.name}</h2>
              <p className="text-sm text-muted-foreground">{agent.role || 'Assistant'}</p>
            </div>
          </div>
          <button
            onClick={handleEditBasicInfo}
            className="p-2 hover:bg-accent rounded transition-colors"
            title="Edit agent details"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full border ${
              STATUS_COLORS[(agent.status || 'active') as keyof typeof STATUS_COLORS]
            }`}
          >
            {(agent.status || 'active').charAt(0).toUpperCase() + (agent.status || 'active').slice(1)}
          </span>
          {agent.defaultModel && (
            <span className="px-2 py-1 text-xs bg-muted rounded-full">
              {agent.defaultModel}
            </span>
          )}
        </div>

        {/* Description */}
        {agent.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {agent.description}
          </p>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Skills Section */}
        <CompactSkillsList
          agentId={agent.id}
          skills={skills}
        />

        {/* Schedules Section */}
        <CompactSchedulesList
          schedules={agent.automations || []}
          onManageSchedules={handleManageSchedules}
        />

        {/* Connections Section */}
        <CompactConnectionsList
          connections={connections}
          onManageConnections={handleManageConnections}
        />
      </div>

      {/* Footer Quick Actions */}
      <div className="p-4 border-t bg-card">
        <button
          onClick={() => openModal('basic-info', { agent })}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
        >
          <Settings className="h-4 w-4" />
          Agent Settings
        </button>
      </div>
    </div>
  );
}
