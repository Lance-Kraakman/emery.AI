'use client';

import { useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import { Agent } from '@/types/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import CapabilityFormDialog from './CapabilityFormDialog';

// AIDEV-NOTE: Capability manager refactored to use consistent design system patterns

interface CapabilityManagerProps {
  agent: Agent;
}

export default function CapabilityManager({ agent }: CapabilityManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const capabilities = agent.capabilities as any[] || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Capabilities</h3>
        <Button
          onClick={() => setIsFormOpen(true)}
          variant="outline"
          size="sm"
        >
          <Settings size={16} className="mr-2" />
          Edit Capabilities
        </Button>
      </div>
      
      {capabilities.length > 0 ? (
        <div className="space-y-4">
          {capabilities.map((cap, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Settings size={18} />
                  {cap.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cap.description && (
                  <p className="text-sm text-muted-foreground">{cap.description}</p>
                )}
                
                {cap.tools && cap.tools.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2">Tools</h5>
                    <div className="flex flex-wrap gap-2">
                      {cap.tools.map((tool: string, toolIndex: number) => (
                        <Badge key={toolIndex} variant="outline">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {cap.servers && cap.servers.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2">Servers</h5>
                    <div className="flex flex-wrap gap-2">
                      {cap.servers.map((server: any, serverIndex: number) => (
                        <Badge key={serverIndex} variant="outline">
                          {typeof server === 'string' ? server : server.name || 'Unknown'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No capabilities configured"
          description="Add capabilities to define what this agent can do"
          action={{
            label: "Configure Capabilities",
            onClick: () => setIsFormOpen(true)
          }}
        />
      )}
      
      <CapabilityFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        agent={agent}
      />
    </div>
  );
}
