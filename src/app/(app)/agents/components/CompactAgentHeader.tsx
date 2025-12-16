'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Settings, Zap, Calendar, Link2, Plus, ChevronRight, ClipboardList, Edit2, Trash2, MoreHorizontal } from 'lucide-react';
import type { AgentDTO } from '@/app/dtos/agent.dto';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import type { ConnectionDTO } from '@/app/mappers/connection-mapper';
import { useModal } from './modals/ModalContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRouter } from 'next/navigation';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { createDefaultAgentSkill } from '@/app/actions/skills';
import { updateAgentFromClient } from '@/app/actions/agents';
import { TaskAssignmentModal } from './TaskAssignmentModal';
import { ShareButton } from '@/components/permissions/ShareButton';
import { ShareDialog } from '@/components/permissions/ShareDialog';

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
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSchedules = agent.schedules?.filter(s => s.enabled).length || 0;
  const totalSchedules = agent.schedules?.length || 0;

  // Container-based responsive behavior
  useEffect(() => {
    const updateCompactMode = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        // Switch to compact mode when container is less than 900px wide
        // This accounts for chat panel reducing available space
        setIsCompact(width < 900);
      }
    };

    // Initial check
    updateCompactMode();

    // Set up ResizeObserver to watch container width changes
    const resizeObserver = new ResizeObserver(updateCompactMode);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const handleAddSkill = async () => {
    setSkillsOpen(false);

    // Create a default skill and navigate to editor
    const result = await createDefaultAgentSkill(agent.id);
    if (result.success && result.data) {
      router.push(`/agents/${agent.id}/skills/${result.data.id}`);
    } else {
      console.error('Failed to create skill:', result.error);
      // TODO: Show toast notification for error
    }
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
    openModal('trigger-config', { agent, mode: 'edit', scheduleIndex });
  };

  const handleDeleteSchedule = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent click handlers

    if (agent.schedules.length === 1) {
      // Cannot delete the last schedule
      return;
    }

    try {
      setDeletingIndex(index);

      const newSchedules = agent.schedules.filter((_, i) => i !== index);

      const result = await updateAgentFromClient(agent.id, {
        schedules: newSchedules
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete schedule');
      }

      // Refresh the page to show updated schedules
      router.refresh();
    } catch (error) {
      console.error('Error deleting schedule:', error);
    } finally {
      setDeletingIndex(null);
    }
  };

  return (
    <div ref={containerRef} className={`flex items-center justify-between px-4 sm:px-6 py-3 border-b bg-card min-w-0 ${className}`}>
      {/* Left side - Agent info and status */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {/* Agent Icon and Name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <AgentAvatar avatarConfig={agent.avatarConfig} agentId={agent.id} size="md" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold truncate">{agent.name}</h1>
            <p className="text-xs text-muted-foreground truncate">{agent.role || 'Assistant'}</p>
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full border shrink-0 ${
            STATUS_COLORS[(agent.status || 'active') as keyof typeof STATUS_COLORS]
          }`}
        >
          {(agent.status || 'active').charAt(0).toUpperCase() + (agent.status || 'active').slice(1)}
        </span>

        {/* Model Badge - Hidden on small screens */}
        {agent.defaultModel && (
          <span className="hidden md:inline-flex px-2 py-1 text-xs bg-muted rounded-full">
            {agent.defaultModel}
          </span>
        )}
      </div>

      {/* Right side - Settings and action badges */}
      <div className="flex items-center gap-1 min-w-0">
        {/* Assign Task Button - Primary Action - Always Visible */}
        <button
          onClick={() => setTaskDialogOpen(true)}
          className="flex items-center gap-1 px-2 xl:px-2.5 py-1.5 text-sm border rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          title="Assign a new task to this agent"
        >
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">Assign Task</span>
        </button>


        {/* Skills Dropdown - Always visible, text hidden when compact */}
        <Popover open={skillsOpen} onOpenChange={setSkillsOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex group relative items-center gap-1 px-2 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
              title={`${skills.length} skills`}
            >
              <Zap className="h-4 w-4 shrink-0" />
              {!isCompact && <span>Skills</span>}
              <span className={`${skills.length > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} 
                text-xs font-medium px-1.5 rounded-full min-w-[1.25rem] text-center`}>
                {skills.length}
              </span>
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

        {/* Schedules Dropdown - Always visible, text hidden when compact */}
        <Popover open={schedulesOpen} onOpenChange={setSchedulesOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex group relative items-center gap-1 px-2 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
              title={`${activeSchedules} active, ${totalSchedules} total schedules`}
            >
              <Calendar className="h-4 w-4 shrink-0" />
              {!isCompact && <span>Schedules</span>}
              <span className={`${activeSchedules > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} 
                text-xs font-medium px-1.5 rounded-full min-w-[2.5rem] text-center`}>
                {activeSchedules}/{totalSchedules}
              </span>
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
                      <div
                        key={index}
                        className="group flex items-center justify-between px-4 py-2 hover:bg-accent transition-colors"
                      >
                        <button
                          onClick={() => handleScheduleClick(index)}
                          className="flex-1 min-w-0 text-left"
                        >
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
                        </button>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => handleScheduleClick(index)}
                            className="p-1.5 rounded hover:bg-accent-foreground/10 transition-colors"
                            title="Edit schedule"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteSchedule(index, e)}
                            disabled={deletingIndex === index || agent.schedules.length === 1}
                            className="p-1.5 rounded hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={agent.schedules.length === 1 ? "Cannot delete last schedule" : "Delete schedule"}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </div>
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

        {/* Connections Button - Always visible, text hidden when compact */}
        <button
          onClick={() => openModal('authorized-connections', { agent })}
          className="flex group relative items-center gap-1 px-2 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
          title={`${connections.length} connections`}
        >
          <Link2 className="h-4 w-4 shrink-0" />
          {!isCompact && <span>Connections</span>}
          <span className={`${connections.length > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} 
            text-xs font-medium px-1.5 rounded-full min-w-[1.25rem] text-center`}>
            {connections.length}
          </span>
        </button>

        {/* Share Button - Always visible */}
        <ShareButton
          resourceType="agent"
          resourceId={agent.id}
          variant="ghost"
          size="icon"
          onShare={() => setShareDialogOpen(true)}
        />

        {/* Settings Dropdown - Always visible */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="p-2 border rounded-md hover:bg-accent transition-colors"
              title="Agent settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <div className="flex flex-col gap-1">
              <button
                onClick={() => openModal('basic-info', { agent })}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
              >
                <Settings className="h-4 w-4" />
                Agent Settings
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Task Assignment Modal */}
      <TaskAssignmentModal
        isOpen={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        agent={agent}
      />

      {/* Share Dialog */}
      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        resourceType="agent"
        resourceId={agent.id}
        resourceName={agent.name}
      />
    </div>
  );
}
