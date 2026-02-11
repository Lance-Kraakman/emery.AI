import type { AgentDTO } from '@/app/dtos/agent.dto';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { Skeleton } from '@/components/ui/skeleton';

// AIDEV-NOTE: Skeleton loading state for agent header
// Shows agent info immediately while skills/connections load

interface AgentHeaderSkeletonProps {
  agent: AgentDTO;
}

const STATUS_COLORS = {
  active: 'bg-success/20 text-success border-success/30',
  inactive: 'bg-muted text-muted-foreground border-border',
  archived: 'bg-destructive/20 text-destructive border-destructive/30',
};

export function AgentHeaderSkeleton({ agent }: AgentHeaderSkeletonProps) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b bg-card min-w-0">
      {/* Left side - Agent info (real data) */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <AgentAvatar avatarConfig={agent.avatarConfig} agentId={agent.id} size="md" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold truncate">{agent.name}</h1>
            <p className="text-xs text-muted-foreground truncate">{agent.role || 'Assistant'}</p>
          </div>
        </div>

        {/* Status Badge (real data) */}
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full border shrink-0 ${
            STATUS_COLORS[(agent.status || 'active') as keyof typeof STATUS_COLORS]
          }`}
        >
          {(agent.status || 'active').charAt(0).toUpperCase() + (agent.status || 'active').slice(1)}
        </span>

        {/* Model Badge */}
        {agent.defaultModel && (
          <span className="hidden md:inline-flex px-2 py-1 text-xs bg-muted rounded-full">
            {agent.defaultModel}
          </span>
        )}
      </div>

      {/* Right side - Loading skeletons for buttons */}
      <div className="flex items-center gap-1 min-w-0 overflow-hidden">
        {/* Assign Task Button skeleton */}
        <Skeleton className="h-8 w-24" />

        {/* Skills button skeleton */}
        <Skeleton className="h-8 w-20" />

        {/* Schedules button skeleton */}
        <Skeleton className="h-8 w-24" />

        {/* Connections button skeleton */}
        <Skeleton className="h-8 w-24" />

        {/* Download button skeleton */}
        <Skeleton className="h-8 w-8" />

        {/* Share button skeleton */}
        <Skeleton className="h-8 w-8" />

        {/* Settings button skeleton */}
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  );
}
