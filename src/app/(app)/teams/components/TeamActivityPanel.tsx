'use client';

import React, { useState, useEffect } from 'react';
import type { TeamDTO } from '@/src/app/mappers/team-mapper';

interface TeamActivityPanelProps {
  team: TeamDTO;
}

interface ActivityItem {
  id: string;
  type: 'member_added' | 'member_removed' | 'agent_added' | 'agent_removed' | 'team_updated';
  message: string;
  timestamp: Date;
  userId?: string;
}

export default function TeamActivityPanel({ team }: TeamActivityPanelProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    // AIDEV-TODO: Implement actual activity tracking from database
    // For now, show placeholder content
    setLoading(false);
    setActivities([
      {
        id: '1',
        type: 'team_updated',
        message: 'Team was created',
        timestamp: new Date(team.createdAt || new Date()),
      }
    ]);
  }, [team.id]);

  if (loading) {
    return <div className="text-muted-foreground">Loading team activity...</div>;
  }

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'member_added':
        return '👤+';
      case 'member_removed':
        return '👤-';
      case 'agent_added':
        return '🤖+';
      case 'agent_removed':
        return '🤖-';
      case 'team_updated':
        return '✏️';
      default:
        return '📝';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-foreground">Recent Activity</h3>

      {activities.length > 0 ? (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3 p-3 border rounded">
              <span className="text-lg flex-shrink-0">{getActivityIcon(activity.type)}</span>
              <div className="flex-1">
                <p className="text-foreground">{activity.message}</p>
                <p className="text-sm text-muted-foreground">
                  {hasMounted ? `${activity.timestamp.toLocaleDateString()} at ${activity.timestamp.toLocaleTimeString()}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>No recent activity for this team.</p>
          <p className="text-sm">Activity will appear here as team changes are made.</p>
        </div>
      )}
    </div>
  );
}
