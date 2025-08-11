'use client';

import { useState } from 'react';
import { Edit } from 'lucide-react';
import { Agent } from '@/types/db';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import CapabilityManager from './CapabilityManager';
import AgentActivityPanel from './AgentActivityPanel';

// AIDEV-NOTE: Agent details view refactored to use consistent design system patterns

interface AgentDetailsViewProps {
  agent: Agent;
  onEdit: () => void;
}

export default function AgentDetailsView({ agent, onEdit }: AgentDetailsViewProps) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">{agent.name}</h2>
          {agent.role && (
            <p className="text-muted-foreground">{agent.role}</p>
          )}
          {agent.status && (
            <Badge variant={agent.status === 'active' ? 'success' : 'secondary'}>
              {agent.status}
            </Badge>
          )}
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="space-y-4">
            {agent.description && (
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Description</h3>
                <p className="text-muted-foreground">{agent.description}</p>
              </div>
            )}
            {agent.persona && (
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Persona</h3>
                <p className="text-muted-foreground">{agent.persona}</p>
              </div>
            )}
            {agent.tools && Array.isArray(agent.tools) && agent.tools.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Tools</h3>
                <div className="flex flex-wrap gap-2">
                  {agent.tools.map((tool: any, index: number) => (
                    <Badge key={index} variant="outline">
                      {typeof tool === 'string' ? tool : tool.name || 'Unknown'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {agent.servers && Array.isArray(agent.servers) && agent.servers.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Servers</h3>
                <div className="flex flex-wrap gap-2">
                  {agent.servers.map((server: any, index: number) => (
                    <Badge key={index} variant="outline">
                      {typeof server === 'string' ? server : server.name || 'Unknown'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="capabilities" className="mt-6">
          <CapabilityManager agent={agent} />
        </TabsContent>
        
        <TabsContent value="activity" className="mt-6">
          <AgentActivityPanel agent={agent} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
