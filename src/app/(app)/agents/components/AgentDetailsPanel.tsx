'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Settings,
  Calendar,
  Database,
  Activity,
  Zap,
  Globe
} from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfigurationCard } from './ConfigurationCard';
import { useModal } from './modals/ModalContext';
import { ScheduleManagerModal } from './modals/ScheduleManagerModal';
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
  const [isScheduleManagerOpen, setIsScheduleManagerOpen] = useState(false);

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
    if (!agent.schedules || agent.schedules.length === 0) return 'partial';
    const firstSchedule = agent.schedules[0];
    if (!firstSchedule || firstSchedule.type === 'MANUAL') return 'partial';
    return 'configured';
  };


  // Generate summaries for each configuration area
  const getTriggerSummary = () => {
    if (!agent.schedules || agent.schedules.length === 0) {
      return 'Manual execution only';
    }

    const scheduleCount = agent.schedules.length;
    const firstSchedule = agent.schedules[0];

    if (!firstSchedule || firstSchedule.type === 'MANUAL') {
      return 'Manual execution only';
    }

    let summary = '';

    if (isCalendarTrigger(firstSchedule)) {
      const timezone = firstSchedule.timezone || 'UTC';
      summary = `Scheduled execution • ${timezone}`;
    } else if (isDatabaseEventTrigger(firstSchedule)) {
      const ops = firstSchedule.operations.join(', ');
      const table = firstSchedule.tableId ? ` on ${firstSchedule.tableId}` : ' on all tables';
      summary = `${ops}${table}`;
    } else if (isWebhookTrigger(firstSchedule)) {
      const security = firstSchedule.requiresSignature ? 'Secured' : 'Open';
      summary = `Webhook trigger • ${security}`;
    } else {
      summary = getTriggerTypeLabel(firstSchedule.type);
    }

    if (scheduleCount > 1) {
      summary += ` (+${scheduleCount - 1} more)`;
    }

    return summary;
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

        {/* Schedule Configuration */}
        <ConfigurationCard
          title="Schedule Configuration"
          description="Manage multiple execution triggers"
          icon={agent.schedules?.[0]?.type === 'CALENDAR' ? Calendar :
                agent.schedules?.[0]?.type === 'DATABASE_EVENT' ? Database :
                agent.schedules?.[0]?.type === 'WEBHOOK' ? Globe : Zap}
          status={getTriggerStatus()}
          statusText={getTriggerStatus() === 'configured' ? 'Configured' : 'Default'}
          summary={getTriggerSummary()}
          onClick={() => setIsScheduleManagerOpen(true)}
          actionText="Manage Schedules"
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

        {/* Skills - Linked to separate page */}
        <ConfigurationCard
          title="Skills"
          description="Multi-step workflows and tasks"
          icon={Settings}
          status="partial"
          statusText="View Skills"
          summary="Skills are managed separately per agent"
          onClick={() => router.push(`/agents/${agent.id}/skills`)}
          actionText="Manage Skills"
        />
      </div>

      {/* Schedule Manager Modal */}
      <ScheduleManagerModal
        isOpen={isScheduleManagerOpen}
        onClose={() => setIsScheduleManagerOpen(false)}
        agent={agent}
        onUpdate={onUpdate}
      />
    </div>
  );
}