'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Settings,
  Calendar,
  Database,
  Wrench,
  Activity,
  Zap,
  Globe
} from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfigurationCard } from './ConfigurationCard';
import { useModal } from './modals/ModalContext';
import { getOrganizationMembers } from '@/app/actions/invitations';
import {
  isCalendarTrigger,
  isDatabaseEventTrigger,
  isWebhookTrigger,
  getTriggerTypeLabel
} from './trigger-utils';

interface AgentDetailsPanelProps {
  agent: AgentDTO;
  onUpdate?: () => void;
}

interface User {
  id: string;
  name: string;
  email: string;
  systemRole?: string;
}

export function AgentDetailsPanel({ agent, onUpdate }: AgentDetailsPanelProps) {
  const router = useRouter();
  const { openModal } = useModal();
  const [ownerName, setOwnerName] = useState<string>('Loading...');
  const [users, setUsers] = useState<User[]>([]);

  // Load organization members to get owner name
  useEffect(() => {
    loadOwnerName();
  }, [agent.ownerId]);

  const loadOwnerName = async () => {
    try {
      const members = await getOrganizationMembers();
      setUsers(members || []);
      const owner = members?.find(u => u.id === agent.ownerId);
      setOwnerName(owner?.name || 'Unknown User');
    } catch (error) {
      console.error('Error loading owner name:', error);
      setOwnerName('Unknown User');
    }
  };

  // Determine configuration status for each area
  const getBasicInfoStatus = () => {
    if (!agent.role || agent.role === 'No role specified') return 'partial';
    return agent.name && agent.role && agent.ownerId ? 'configured' : 'empty';
  };

  const getBasicInfoSummary = () => {
    const parts = [];
    if (agent.name) parts.push(agent.name);
    if (ownerName !== 'Loading...' && ownerName !== 'Unknown User') {
      parts.push(`Owner: ${ownerName}`);
    }
    if (agent.role && agent.role !== 'No role specified') {
      parts.push(`Role: ${agent.role}`);
    }
    return parts.join(' • ') || 'Basic information needs setup';
  };

  const getTriggerStatus = () => {
    if (!agent.trigger || agent.trigger.type === 'MANUAL') return 'partial';
    return 'configured';
  };

  const getCapabilitiesStatus = () => {
    const count = agent.capabilities?.length || 0;
    if (count === 0) return 'empty';
    if (count < 3) return 'partial';
    return 'configured';
  };

  const getToolsStatus = () => {
    const toolCount = agent.tools?.length || 0;
    const serverCount = agent.servers?.length || 0;
    if (toolCount === 0 && serverCount === 0) return 'empty';
    if (toolCount > 0 && serverCount > 0) return 'configured';
    return 'partial';
  };

  // Generate summaries for each configuration area
  const getTriggerSummary = () => {
    if (!agent.trigger || agent.trigger.type === 'MANUAL') {
      return 'Manual execution only';
    }

    if (isCalendarTrigger(agent.trigger)) {
      const timezone = agent.trigger.timezone || 'UTC';
      return `Scheduled execution • ${timezone}`;
    }

    if (isDatabaseEventTrigger(agent.trigger)) {
      const ops = agent.trigger.operations.join(', ');
      const table = agent.trigger.tableId ? ` on ${agent.trigger.tableId}` : ' on all tables';
      return `${ops}${table}`;
    }

    if (isWebhookTrigger(agent.trigger)) {
      const security = agent.trigger.requiresSignature ? 'Secured' : 'Open';
      return `Webhook trigger • ${security}`;
    }

    return getTriggerTypeLabel(agent.trigger.type);
  };

  const getCapabilitiesSummary = () => {
    const count = agent.capabilities?.length || 0;
    if (count === 0) return 'No capabilities defined';

    const totalSteps = agent.capabilities?.reduce((sum, cap) => sum + (cap.steps?.length || 0), 0) || 0;
    return `${count} capability${count !== 1 ? 'ies' : ''} • ${totalSteps} total steps`;
  };

  const getToolsSummary = () => {
    const toolCount = agent.tools?.length || 0;
    const serverCount = agent.servers?.length || 0;

    if (toolCount === 0 && serverCount === 0) return 'No tools or servers configured';

    const parts = [];
    if (toolCount > 0) parts.push(`${toolCount} tool${toolCount !== 1 ? 's' : ''}`);
    if (serverCount > 0) parts.push(`${serverCount} server${serverCount !== 1 ? 's' : ''}`);

    return parts.join(' • ');
  };

  return (
    <div className="space-y-3">
      {/* Agent Description - Only if exists */}
      {agent.description && (
        <div>
          <p className="text-sm text-muted-foreground">{agent.description}</p>
        </div>
      )}

      {/* Configuration Cards Grid */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Basic Information */}
        <ConfigurationCard
          title="Basic Information"
          description="Name, owner, role, and status"
          icon={User}
          status={getBasicInfoStatus()}
          statusText={getBasicInfoStatus() === 'configured' ? 'Complete' : 'Incomplete'}
          summary={getBasicInfoSummary()}
          onClick={() => openModal('basic-info', { agent })}
          actionText="Edit Details"
        />

        {/* Trigger Configuration */}
        <ConfigurationCard
          title="Trigger Configuration"
          description="Execution timing and conditions"
          icon={agent.trigger?.type === 'CALENDAR' ? Calendar :
                agent.trigger?.type === 'DATABASE_EVENT' ? Database :
                agent.trigger?.type === 'WEBHOOK' ? Globe : Zap}
          status={getTriggerStatus()}
          statusText={getTriggerStatus() === 'configured' ? 'Configured' : 'Default'}
          summary={getTriggerSummary()}
          onClick={() => openModal('trigger-config', { agent })}
          actionText="Configure Trigger"
        />

        {/* Tools & Servers */}
        <ConfigurationCard
          title="Tools & Servers"
          description="External integrations"
          icon={Wrench}
          status={getToolsStatus()}
          statusText={
            getToolsStatus() === 'configured' ? 'Configured' :
            getToolsStatus() === 'partial' ? 'Partial' : 'None'
          }
          summary={getToolsSummary()}
          onClick={() => openModal('tools-servers', { agent })}
          actionText="Manage Tools"
        />

        {/* Activity */}
        <ConfigurationCard
          title="Recent Activity"
          description="Execution logs and metrics"
          icon={Activity}
          status="configured"
          statusText="Available"
          summary="View execution logs and metrics"
          onClick={() => openModal('activity-details', { agent })}
          actionText="View Activity"
        />
      </div>

      {/* Capabilities - Full Width */}
      <ConfigurationCard
        title="Capabilities"
        description="Multi-step workflows and tasks"
        icon={Settings}
        status={getCapabilitiesStatus()}
        statusText={
          getCapabilitiesStatus() === 'configured' ? 'Well Configured' :
          getCapabilitiesStatus() === 'partial' ? 'Basic Setup' : 'Not Configured'
        }
        summary={getCapabilitiesSummary()}
        onClick={() => router.push(`/agents/${agent.id}/capabilities`)}
        actionText="Manage Capabilities"
        className="md:col-span-2"
      />
    </div>
  );
}