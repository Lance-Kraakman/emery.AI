'use client';

import React, { useState } from 'react';
import { Settings, Zap, Calendar, Link2, Plus, ChevronRight } from 'lucide-react';
import type { AgentDTO } from '@/app/dtos/agent.dto';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import type { ConnectionDTO } from '@/app/mappers/connection-mapper';
import { useModal } from './modals/ModalContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRouter } from 'next/navigation';
import { AgentAvatar } from '@/components/agents/AgentAvatar';

interface CompactAgentHeaderProps {
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

export function CompactAgentHeader({
  agent,
  skills,
  connections,
  className = ''
}: CompactAgentHeaderProps) {
  const { openModal } = useModal();
  const router = useRouter();
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [schedulesOpen, setSchedulesOpen] = useState(false);

  const activeSchedules = agent.schedules?.filter(s => s.enabled).length || 0;
  const totalSchedules = agent.schedules?.length || 0;

  const handleAddSkill = () => {
    setSkillsOpen(false);
    router.push(`/agents/${agent.id}/skills`);
  };

  const handleSkillClick = (skillId: number) => {
    setSkillsOpen(false);
    router.push(`/agents/${agent.id}/skills/${skillId}`);
  };

  const handleAddSchedule = () => {
    setSchedulesOpen(false);
    openModal('trigger-config', { agent });
  };

  const handleScheduleClick = (scheduleIndex: number) => {
    setSchedulesOpen(false);
    // Could open schedule edit modal here if needed
    openModal('trigger-config', { agent });
  };

  return (
    <div className={`flex items-center justify-between px-6 py-3 border-b bg-card ${className}`}>
      {/* Left side - Agent info and status */}
      <div className="flex items-center gap-4">
        {/* Agent Icon and Name */}
        <div className="flex items-center gap-3">
          <AgentAvatar avatarConfig={agent.avatarConfig} agentId={agent.id} size="md" />
          <div>
            <h1 className="text-lg font-semibold">{agent.name}</h1>
            <p className="text-xs text-muted-foreground">{agent.role || 'Assistant'}</p>
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full border ${
            STATUS_COLORS[(agent.status || 'active') as keyof typeof STATUS_COLORS]
          }`}
        >
          {(agent.status || 'active').charAt(0).toUpperCase() + (agent.status || 'active').slice(1)}
        </span>

        {/* Model Badge */}
        {agent.defaultModel && (
          <span className="px-2 py-1 text-xs bg-muted rounded-full">
            {agent.defaultModel}
          </span>
        )}
      </div>

      {/* Right side - Badges and actions */}
      <div className="flex items-center gap-2">
        {/* Skills Dropdown */}
        <Popover open={skillsOpen} onOpenChange={setSkillsOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
              title="View skills"
            >
              <Zap className="h-3.5 w-3.5" />
              Skills ({skills.length})
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex flex-col">
              {/* Header */}
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold text-sm">Skills</h3>
              </div>

              {/* Skills List */}
              <div className="max-h-[300px] overflow-y-auto">
                {skills.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No skills configured
                  </div>
                ) : (
                  <div className="py-1">
                    {skills.map((skill) => (
                      <button
                        key={skill.id}
                        onClick={() => handleSkillClick(skill.id)}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-accent transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{skill.name}</div>
                          {skill.description && (
                            <div className="text-xs text-muted-foreground truncate">{skill.description}</div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Button */}
              <div className="border-t p-2">
                <button
                  onClick={handleAddSkill}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Skill
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Schedules Dropdown */}
        <Popover open={schedulesOpen} onOpenChange={setSchedulesOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
              title="View schedules"
            >
              <Calendar className="h-3.5 w-3.5" />
              Schedules ({activeSchedules}/{totalSchedules})
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex flex-col">
              {/* Header */}
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold text-sm">Schedules</h3>
              </div>

              {/* Schedules List */}
              <div className="max-h-[300px] overflow-y-auto">
                {!agent.schedules || agent.schedules.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No schedules configured
                  </div>
                ) : (
                  <div className="py-1">
                    {agent.schedules.map((schedule, index) => (
                      <button
                        key={index}
                        onClick={() => handleScheduleClick(index)}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-accent transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium truncate">
                              {schedule.name || `Schedule ${index + 1}`}
                            </div>
                            <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                              schedule.enabled
                                ? 'bg-green-500/20 text-green-600'
                                : 'bg-gray-500/20 text-gray-600'
                            }`}>
                              {schedule.enabled ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {schedule.description && (
                            <div className="text-xs text-muted-foreground truncate">{schedule.description}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {schedule.trigger.type}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Button */}
              <div className="border-t p-2">
                <button
                  onClick={handleAddSchedule}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Schedule
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Connections Badge - Opens Modal */}
        <button
          onClick={() => openModal('authorized-connections', { agent })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
          title="Manage connections"
        >
          <Link2 className="h-3.5 w-3.5" />
          Connections ({connections.length})
        </button>

        {/* Settings Button */}
        <button
          onClick={() => openModal('basic-info', { agent })}
          className="p-2 border rounded-md hover:bg-accent transition-colors"
          title="Agent settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
