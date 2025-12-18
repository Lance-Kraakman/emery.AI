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
  Globe,
  Shield
} from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { OrganizationMapper, type UserDTO } from '@/app/mappers/organization-mapper';
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
import { getDelegationStatus } from '../lib/delegation-helpers';
import { getAgentDelegationCount } from '@/app/actions/delegations';

interface AgentDetailsPanelProps {
  agent: AgentDTO;
  onUpdate?: () => void;
}

export function AgentDetailsPanel({ agent, onUpdate }: AgentDetailsPanelProps) {
  const router = useRouter();
  const { openModal } = useModal();
  const [ownerName, setOwnerName] = useState<string>('Loading...');
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [isScheduleManagerOpen, setIsScheduleManagerOpen] = useState(false);
  const [delegationCount, setDelegationCount] = useState<number>(0);

  // Load organization members to get owner name
  useEffect(() => {
    loadOwnerName();
  }, [agent.ownerId]);

  // Load delegation count
  useEffect(() => {
    loadDelegationCount();
  }, [agent.id]);

  const loadOwnerName = async () => {
    try {
      const members = await getOrganizationMembers();
      const mappedUsers = members ? members.map(OrganizationMapper.memberToUser) : [];
      setUsers(mappedUsers);
      const owner = mappedUsers?.find(u => u.id === agent.ownerId);
      setOwnerName(owner ? `${owner.name} (${OrganizationMapper.getPrimaryRoleName(owner.roles)})` : 'Unknown User');
    } catch (error) {
      console.error('Error loading owner name:', error);
      setOwnerName('Unknown User');
    }
  };

  const loadDelegationCount = async () => {
    try {
      const count = await getAgentDelegationCount(agent.id);
      setDelegationCount(count);
    } catch (error) {
      console.error('Error loading delegation count:', error);
      setDelegationCount(0);
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
    if (!firstSchedule) return 'partial';
    return 'configured';
  };


  // Generate summaries for each configuration area
  const getTriggerSummary = () => {
    if (!agent.schedules || agent.schedules.length === 0) {
      return 'Manual execution only';
    }

    const scheduleCount = agent.schedules.length;
    const firstSchedule = agent.schedules[0];

    if (!firstSchedule) {
      return 'Manual execution only';
    }

    let summary = '';
    const trigger = firstSchedule.trigger;

    if (trigger.type === 'CALENDAR') {
      const timezone = trigger.timezone || 'UTC';
      summary = `Scheduled execution • ${timezone}`;
    } else if (trigger.type === 'DATABASE_EVENT') {
      const ops = trigger.operations?.join(', ') || 'No operations';
      const table = trigger.tableId ? ` on ${trigger.tableId}` : ' on all tables';
      summary = `${ops}${table}`;
    } else if (trigger.type === 'WEBHOOK') {
      const security = trigger.requiresSignature ? 'Secured' : 'Open';
      summary = `Webhook trigger • ${security}`;
    }
    // MANUAL type is already handled above, no else needed

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
          icon={agent.schedules?.[0]?.trigger.type === 'CALENDAR' ? Calendar :
                agent.schedules?.[0]?.trigger.type === 'DATABASE_EVENT' ? Database :
                agent.schedules?.[0]?.trigger.type === 'WEBHOOK' ? Globe : Zap}
          status={getTriggerStatus()}
          statusText={getTriggerStatus() === 'configured' ? 'Configured' : 'Default'}
          summary={getTriggerSummary()}
          onClick={() => setIsScheduleManagerOpen(true)}
          actionText="Manage Schedules"
        />

        {/* Authorized Connections */}
        <ConfigurationCard
          title="Authorized Connections"
          description="OAuth credentials for external services"
          icon={Shield}
          status={getDelegationStatus(delegationCount).status}
          statusText={getDelegationStatus(delegationCount).statusText}
          summary={delegationCount === 0 ? 'No services authorized' : `Agent can access ${delegationCount} service${delegationCount === 1 ? '' : 's'}`}
          onClick={() => openModal('authorized-connections', { agent })}
          actionText="Manage Connections"
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