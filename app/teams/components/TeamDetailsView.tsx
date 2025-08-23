'use client';

import { useState } from 'react';
import { Edit, Users, Target, CheckCircle } from 'lucide-react';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import type { Team } from '@/types/db';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TeamMembersPanel from './TeamMembersPanel';
import TeamActivityPanel from './TeamActivityPanel';

// AIDEV-NOTE: Team details view refactored to use consistent design system patterns

interface TeamDetailsViewProps {
  team: Team;
  agents: Agent[];
  onEdit: () => void;
}

export default function TeamDetailsView({ team, agents, onEdit }: TeamDetailsViewProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Get agents that belong to this team
  const teamAgents = agents.filter(agent => 
    team.agentIds && team.agentIds.includes(agent.id.toString())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">{team.name}</h2>
          {team.purpose && (
            <p className="text-muted-foreground">{team.purpose}</p>
          )}
          <div className="flex gap-2 mt-2">
            <Badge variant="outline">
              <Users size={12} className="mr-1" />
              {teamAgents.length} agent{teamAgents.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
        <Button
          onClick={onEdit}
          variant="outline"
          size="sm"
        >
          <Edit size={16} />
          Edit
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agents ({teamAgents.length})</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {team.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{team.description}</p>
                </CardContent>
              </Card>
            )}
            
            {team.responsibilities && team.responsibilities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle size={18} />
                    Responsibilities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {team.responsibilities.map((responsibility, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{responsibility}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            
            {team.goals && team.goals.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target size={18} />
                    Goals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {team.goals.map((goal, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Target size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{goal}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="agents" className="mt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Team Agents</h3>
            {teamAgents.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {teamAgents.map((agent) => (
                  <Card key={agent.id}>
                    <CardContent className="p-4">
                      <h4 className="font-medium text-foreground">{agent.name}</h4>
                      <p className="text-sm text-muted-foreground">{agent.role}</p>
                      {agent.description && (
                        <p className="text-xs text-muted-foreground mt-2">{agent.description}</p>
                      )}
                      {agent.status && (
                        <Badge 
                          variant={agent.status === 'active' ? 'success' : 'secondary'}
                          className="mt-2"
                        >
                          {agent.status}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No agents assigned to this team.</p>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="members" className="mt-6">
          <TeamMembersPanel team={team} />
        </TabsContent>
        
        <TabsContent value="activity" className="mt-6">
          <TeamActivityPanel team={team} />
        </TabsContent>
      </Tabs>
    </div>
  );
}