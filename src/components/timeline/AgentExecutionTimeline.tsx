'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { format, subDays, addDays, isWithinInterval } from 'date-fns';
import { RRule } from 'rrule';
import type { TaskDTO } from '@/app/mappers/task-mapper';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { TaskCard } from '@/components/tasks/TaskCard';

interface TimelineTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
  status: 'completed' | 'failed' | 'in_progress' | 'pending' | 'scheduled';
  type: 'execution' | 'scheduled';
  triggerContext?: any; // Trigger information (schedule name, type, etc.)
  error?: string;
  task?: TaskDTO; // Full task data for details
  lane: string; // Swim lane identifier
  stackLevel: number; // Vertical stacking position within lane
}

interface SwimLane {
  id: string;
  name: string;
  tasks: TimelineTask[];
}

interface AgentExecutionTimelineProps {
  tasks: TaskDTO[];
  schedules?: AutomationConfigurationDTO[];
  className?: string;
}

type ViewMode = 'hour' | '6hours' | '12hours' | 'day' | 'week' | 'month' | '3months' | 'year';

const STATUS_COLORS = {
  completed: '#10b981',
  failed: '#ef4444',
  in_progress: '#3b82f6',
  pending: '#f59e0b',
  scheduled: '#8b5cf6',
};

const STATUS_BACKGROUND = {
  completed: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  failed: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  in_progress: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  pending: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  scheduled: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
};

const VIEW_CONFIG = {
  hour: { days: 1/24, label: 'Hour', tickFormat: 'HH:mm', tickCount: 12, todayLabel: 'Now' },
  '6hours': { days: 0.25, label: '6 Hours', tickFormat: 'HH:mm', tickCount: 6, todayLabel: 'Last 6h' },
  '12hours': { days: 0.5, label: '12 Hours', tickFormat: 'HH:mm', tickCount: 12, todayLabel: 'Last 12h' },
  day: { days: 1, label: 'Day', tickFormat: 'HH:mm', tickCount: 12, todayLabel: 'Today' },
  week: { days: 7, label: 'Week', tickFormat: 'EEE dd', tickCount: 7, todayLabel: 'This Week' },
  month: { days: 30, label: 'Month', tickFormat: 'MMM dd', tickCount: 10, todayLabel: 'This Month' },
  '3months': { days: 90, label: '3 Months', tickFormat: 'MMM dd', tickCount: 9, todayLabel: 'This Quarter' },
  year: { days: 365, label: 'Year', tickFormat: 'MMM', tickCount: 12, todayLabel: 'This Year' },
};

const LANE_HEIGHT = 60;
const TASK_HEIGHT = 24;
const TASK_PADDING = 4;

export function AgentExecutionTimeline({ tasks, schedules = [], className = '' }: AgentExecutionTimelineProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Mouse wheel horizontal scroll handler
  useEffect(() => {
    const container = timelineRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Check if horizontal scroll intent (shift key or horizontal gesture)
      const isHorizontalScroll = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);

      if (isHorizontalScroll) {
        e.preventDefault();

        const scrollAmount = e.deltaX || e.deltaY;
        const config = VIEW_CONFIG[viewMode];
        const totalDuration = config.days * 24 * 60 * 60 * 1000; // Convert days to milliseconds

        // Calculate time shift (1% of viewport per 10px scroll)
        const percentChange = scrollAmount / (container.clientWidth * 10);
        const timeShift = totalDuration * percentChange;

        setCurrentDate(prev => new Date(prev.getTime() + timeShift));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [viewMode]);

  const { startDate, endDate } = useMemo(() => {
    const config = VIEW_CONFIG[viewMode];

    // For day view, show full 24 hours (00:00 to 23:59)
    if (viewMode === 'day') {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }

    // For hour/sub-day views, calculate using hours
    if (config.days < 1) {
      const hours = config.days * 24;
      const start = new Date(currentDate.getTime() - (hours / 2) * 60 * 60 * 1000);
      const end = new Date(currentDate.getTime() + (hours / 2) * 60 * 60 * 1000);
      return { startDate: start, endDate: end };
    }

    // For other views, center on current date
    const start = subDays(currentDate, Math.floor(config.days / 2));
    const end = addDays(currentDate, Math.ceil(config.days / 2));
    return { startDate: start, endDate: end };
  }, [viewMode, currentDate]);

  const handlePrevious = () => {
    const config = VIEW_CONFIG[viewMode];
    if (config.days < 1) {
      // For sub-day views, navigate by hours
      const hours = config.days * 24;
      setCurrentDate(prev => new Date(prev.getTime() - hours * 60 * 60 * 1000));
    } else {
      setCurrentDate(prev => subDays(prev, config.days));
    }
  };

  const handleNext = () => {
    const config = VIEW_CONFIG[viewMode];
    if (config.days < 1) {
      // For sub-day views, navigate by hours
      const hours = config.days * 24;
      setCurrentDate(prev => new Date(prev.getTime() + hours * 60 * 60 * 1000));
    } else {
      setCurrentDate(prev => addDays(prev, config.days));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Group tasks into swim lanes and calculate stacking
  const swimLanes = useMemo<SwimLane[]>(() => {
    const lanes = new Map<string, TimelineTask[]>();

    // Process execution tasks
    tasks.forEach(task => {
      const start = new Date(task.startedAt || task.createdAt);
      const end = new Date(task.completedAt || task.startedAt || task.createdAt);

      // Default to 5 minutes if task hasn't completed
      if (start.getTime() === end.getTime() && task.status !== 'completed') {
        end.setMinutes(end.getMinutes() + 5);
      }

      if (isWithinInterval(start, { start: startDate, end: endDate }) ||
          isWithinInterval(end, { start: startDate, end: endDate })) {
        const laneName = task.triggerContext?.scheduleName || 'Manual Tasks';

        if (!lanes.has(laneName)) {
          lanes.set(laneName, []);
        }

        lanes.get(laneName)!.push({
          id: task.id,
          name: task.name,
          start,
          end,
          status: task.status as TimelineTask['status'],
          type: 'execution',
          triggerContext: task.triggerContext,
          error: task.error || undefined,
          task,
          lane: laneName,
          stackLevel: 0, // Will be calculated
        });
      }
    });

    // Process scheduled tasks
    schedules.forEach((schedule, idx) => {
      if (schedule.trigger.type === 'CALENDAR' && schedule.trigger.enabled && schedule.enabled) {
        try {
          const rrule = RRule.fromString(schedule.trigger.rrule);
          const futureOccurrences = rrule.between(new Date(), endDate);

          futureOccurrences.forEach((date, occIdx) => {
            const endTime = new Date(date);
            endTime.setMinutes(endTime.getMinutes() + 30);

            const laneName = schedule.name || 'Scheduled Tasks';

            if (!lanes.has(laneName)) {
              lanes.set(laneName, []);
            }

            lanes.get(laneName)!.push({
              id: `scheduled-${idx}-${occIdx}`,
              name: schedule.name || `Skill ${schedule.skillId}`,
              start: date,
              end: endTime,
              status: 'scheduled',
              type: 'scheduled',
              lane: laneName,
              stackLevel: 0,
            });
          });
        } catch (error) {
          console.error('Error parsing rrule:', error);
        }
      }
    });

    // Calculate stacking levels for overlapping tasks within each lane
    const result: SwimLane[] = [];
    lanes.forEach((laneTasks, laneName) => {
      // Sort by start time
      laneTasks.sort((a, b) => a.start.getTime() - b.start.getTime());

      // Calculate stack levels
      const stackedTasks = laneTasks.map(task => ({ ...task }));
      stackedTasks.forEach((task, index) => {
        let level = 0;
        const previousTasks = stackedTasks.slice(0, index);

        while (true) {
          const conflicts = previousTasks.filter(prev =>
            prev.stackLevel === level &&
            !(task.start.getTime() >= prev.end.getTime() || task.end.getTime() <= prev.start.getTime())
          );

          if (conflicts.length === 0) {
            break;
          }
          level++;
        }

        task.stackLevel = level;
      });

      result.push({
        id: laneName,
        name: laneName,
        tasks: stackedTasks,
      });
    });

    // Sort lanes by number of tasks (descending)
    result.sort((a, b) => b.tasks.length - a.tasks.length);

    return result;
  }, [tasks, schedules, startDate, endDate]);

  const timelineWidth = 1000; // Will be container width
  const totalHeight = swimLanes.reduce((acc, lane) => {
    const maxStack = Math.max(0, ...lane.tasks.map(t => t.stackLevel));
    return acc + Math.max(LANE_HEIGHT, (maxStack + 1) * (TASK_HEIGHT + TASK_PADDING) + 30);
  }, 0);

  const getTaskX = (task: TimelineTask): number => {
    const totalDuration = endDate.getTime() - startDate.getTime();
    const taskOffset = task.start.getTime() - startDate.getTime();
    return (taskOffset / totalDuration) * 100; // Percentage
  };

  const getTaskWidth = (task: TimelineTask): number => {
    const totalDuration = endDate.getTime() - startDate.getTime();
    const taskDuration = task.end.getTime() - task.start.getTime();
    const calculatedWidth = (taskDuration / totalDuration) * 100;

    // Minimum width of 1% or 8px, whichever is larger for visibility
    return Math.max(1, calculatedWidth);
  };

  const getTaskY = (laneIndex: number, stackLevel: number): number => {
    let y = 0;
    for (let i = 0; i < laneIndex; i++) {
      const lane = swimLanes[i];
      const maxStack = Math.max(0, ...lane.tasks.map(t => t.stackLevel));
      y += Math.max(LANE_HEIGHT, (maxStack + 1) * (TASK_HEIGHT + TASK_PADDING) + 30);
    }
    return y + 25 + (stackLevel * (TASK_HEIGHT + TASK_PADDING));
  };

  const handleTaskClick = (taskId: string) => {
    setExpandedTaskId(prev => prev === taskId ? null : taskId);
  };

  // Generate time markers
  const timeMarkers = useMemo(() => {
    const config = VIEW_CONFIG[viewMode];
    const markers: Date[] = [];
    const step = (endDate.getTime() - startDate.getTime()) / config.tickCount;

    for (let i = 0; i <= config.tickCount; i++) {
      markers.push(new Date(startDate.getTime() + (step * i)));
    }

    return markers;
  }, [startDate, endDate, viewMode]);

  const nowPosition = useMemo(() => {
    const now = new Date();
    if (now < startDate || now > endDate) return null;
    const totalDuration = endDate.getTime() - startDate.getTime();
    const nowOffset = now.getTime() - startDate.getTime();
    return (nowOffset / totalDuration) * 100;
  }, [startDate, endDate]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header - Simplified without navigation controls */}
      <div className="flex flex-col gap-3 mb-4 px-4 pt-4 border-b pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Timeline</h3>
            <p className="text-sm text-muted-foreground">
              {format(startDate, 'MMM dd, yyyy')} - {format(endDate, 'MMM dd, yyyy')}
            </p>
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {(Object.keys(VIEW_CONFIG) as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2 md:px-3 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap ${
                viewMode === mode
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {VIEW_CONFIG[mode].label}
              {viewMode === mode && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Gantt Chart */}
      <div ref={timelineRef} className="flex-1 overflow-auto">
        <div className="relative h-full pb-8" style={totalHeight > 0 ? { minHeight: Math.max(400, totalHeight + 60) } : { minHeight: 400 }}>
          {/* Time axis labels - Fixed at top */}
          <div className="sticky top-0 z-30 bg-card border-b border-border h-8 flex items-center">
            <div className="w-[160px] flex-shrink-0" /> {/* Spacer for lane labels */}
            <div className="flex-1 relative">
              {timeMarkers.map((marker, index) => {
                const position = ((marker.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100;
                return (
                  <div
                    key={index}
                    className="absolute top-0 h-8 flex items-center justify-center"
                    style={{
                      left: `${position}%`,
                      transform: 'translateX(-50%)',
                      minWidth: '60px'
                    }}
                  >
                    <div className="text-xs text-foreground font-medium whitespace-nowrap">
                      {format(marker, VIEW_CONFIG[viewMode].tickFormat)}
                    </div>
                  </div>
                );
              })}

              {/* Now indicator in header */}
              {nowPosition !== null && (
                <div
                  className="absolute top-0 h-8 flex items-center"
                  style={{ left: `${nowPosition}%` }}
                >
                  <div className="text-xs font-bold text-primary whitespace-nowrap pl-1">
                    Now
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Grid lines */}
          <div className="absolute top-8 left-[160px] right-0 bottom-0 pointer-events-none">
            {timeMarkers.map((marker, index) => {
              const position = ((marker.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100;
              return (
                <div
                  key={index}
                  className="absolute top-0 bottom-0 border-l border-border/20"
                  style={{ left: `${position}%` }}
                />
              );
            })}

            {/* Now line */}
            {nowPosition !== null && (
              <div
                className="absolute top-0 bottom-0 border-l-2 border-primary/40 z-10"
                style={{ left: `${nowPosition}%` }}
              />
            )}
          </div>

          {/* Swim lanes */}
          <div className="relative mt-8">
            {swimLanes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tasks or schedules in this time range</p>
              </div>
            ) : (
              swimLanes.map((lane, laneIndex) => {
                const maxStack = Math.max(0, ...lane.tasks.map(t => t.stackLevel));
                const laneHeight = Math.max(LANE_HEIGHT, (maxStack + 1) * (TASK_HEIGHT + TASK_PADDING) + 30);

                return (
                  <div
                    key={lane.id}
                    className="relative border-b border-border/30"
                    style={{ height: laneHeight }}
                  >
                    {/* Lane label */}
                    <div className="absolute left-0 top-2 font-medium text-sm text-foreground max-w-[150px] truncate">
                      {lane.name}
                    </div>

                    {/* Tasks */}
                    <div className="absolute left-[160px] right-0 top-0 bottom-0">
                      {lane.tasks.map((task) => {
                        const x = getTaskX(task);
                        const width = getTaskWidth(task);
                        const y = task.stackLevel * (TASK_HEIGHT + TASK_PADDING) + 10;
                        const isExpanded = expandedTaskId === task.id;

                        return (
                          <div key={task.id}>
                            <button
                              onClick={() => handleTaskClick(task.id)}
                              className="absolute rounded-md transition-all hover:scale-105 hover:shadow-lg shadow-sm"
                              style={{
                                left: `${x}%`,
                                width: `${width}%`,
                                top: y,
                                height: TASK_HEIGHT,
                                background: task.type === 'scheduled'
                                  ? `repeating-linear-gradient(45deg, ${STATUS_COLORS[task.status]}, ${STATUS_COLORS[task.status]} 10px, transparent 10px, transparent 20px), ${STATUS_BACKGROUND[task.status]}`
                                  : STATUS_BACKGROUND[task.status],
                                border: `1px solid ${STATUS_COLORS[task.status]}`,
                                minWidth: '8px',
                                opacity: task.type === 'scheduled' ? 0.7 : 1,
                              }}
                              title={task.name}
                            >
                              <div className="px-2 text-white text-xs truncate font-semibold drop-shadow">
                                {task.name}
                              </div>
                            </button>

                            {/* Expanded task details */}
                            {isExpanded && task.task && (
                              <div
                                className="absolute z-20 mt-1"
                                style={{
                                  left: `${x}%`,
                                  top: y + TASK_HEIGHT + 4,
                                  width: '400px',
                                  maxWidth: '90vw',
                                }}
                              >
                                <TaskCard
                                  task={{
                                    ...task.task,
                                    error: task.task.error || undefined,
                                    completedAt: task.task.completedAt ? task.task.completedAt.toISOString() : undefined,
                                    startedAt: task.task.startedAt ? task.task.startedAt.toISOString() : undefined,
                                    createdAt: task.task.createdAt.toISOString(),
                                  }}
                                  hasMounted={hasMounted}
                                  variant="full"
                                  className="shadow-lg"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar - Sticky */}
      <div className="sticky bottom-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              className="p-2 rounded-md border border-border hover:bg-accent hover:border-accent-foreground/20 transition-all"
              title={`Previous ${VIEW_CONFIG[viewMode].label.toLowerCase()}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-accent hover:border-accent-foreground/20 transition-all min-w-[100px]"
            >
              {VIEW_CONFIG[viewMode].todayLabel}
            </button>
            <button
              onClick={handleNext}
              className="p-2 rounded-md border border-border hover:bg-accent hover:border-accent-foreground/20 transition-all"
              title={`Next ${VIEW_CONFIG[viewMode].label.toLowerCase()}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Scroll Hint */}
            <div className="ml-4 text-xs text-muted-foreground flex items-center gap-1.5 opacity-70">
              <span className="hidden md:inline">Shift + scroll to pan</span>
              <span className="md:hidden">Swipe to pan</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: color,
                    opacity: status === 'scheduled' ? 0.5 : 1,
                    border: status === 'scheduled' ? `2px dashed ${color}` : 'none',
                  }}
                />
                <span className="text-muted-foreground capitalize">
                  {status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
