'use client';

// AIDEV-NOTE: Agents list view showing grid of all agents
// Clicking an agent navigates to /agents/[id] for detail view

import React from 'react';
import { Plus, Bot, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AgentsListViewProps {
  agents: AgentDTO[];
}

export function AgentsListView({ agents }: AgentsListViewProps) {
  const router = useRouter();

  // Show list view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-muted-foreground mt-1">
            Manage your AI agents and their configurations
          </p>
        </div>
        <Button onClick={() => router.push('/agents/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Agent
        </Button>
      </div>

      {/* Agents Grid */}
      {agents.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-muted p-4">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No agents yet</h3>
              <p className="text-muted-foreground mt-1">
                Create your first agent to get started
              </p>
            </div>
            <Button onClick={() => router.push('/agents/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map(agent => (
            <Link key={agent.id} href={`/agents/${agent.id}`}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group">
              <div className="space-y-4">
                {/* Agent Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg line-clamp-1">
                        {agent.name}
                      </h3>
                      {agent.role && (
                        <p className="text-xs text-muted-foreground">
                          {agent.role}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>

                {/* Agent Description */}
                {agent.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.description}
                  </p>
                )}

                {/* Agent Status & Info */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={agent.status === 'active' ? 'default' : 'secondary'}
                  >
                    {agent.status}
                  </Badge>
                  {agent.schedules && agent.schedules.length > 0 && (
                    <Badge variant="outline">
                      {agent.schedules.length} {agent.schedules.length === 1 ? 'schedule' : 'schedules'}
                    </Badge>
                  )}
                </div>

                {/* Database Info */}
                {agent.databaseId && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Database: <span className="text-foreground font-medium">{agent.databaseId}</span>
                    </p>
                  </div>
                )}
              </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
