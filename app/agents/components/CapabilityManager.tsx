'use client';

import { Settings } from 'lucide-react';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

// AIDEV-NOTE: Capability manager refactored to use consistent design system patterns

interface CapabilityManagerProps {
  agent: Agent;
}

export default function CapabilityManager({ agent }: CapabilityManagerProps) {
  const capabilities = agent.capabilities as any[] || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Capabilities</h3>
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
                
                {/* Display steps and their tools (new structure) */}
                {cap.steps && cap.steps.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2">Steps ({cap.steps.length})</h5>
                    <div className="space-y-2">
                      {cap.steps.map((step: any, stepIndex: number) => (
                        <div key={stepIndex} className="p-2 border rounded-md bg-muted/30">
                          {step.instructions && (
                            <p className="text-sm mb-2">{step.instructions}</p>
                          )}
                          {step.tools && step.tools.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {step.tools.map((tool: any, toolIndex: number) => (
                                <Badge key={toolIndex} variant="secondary" className="text-xs">
                                  {tool.display_name || tool.name || tool}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Legacy tools display (old structure) */}
                {cap.tools && cap.tools.length > 0 && !cap.steps && (
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
                
                {/* Legacy servers display (old structure) */}
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
          description="Add capabilities to define what this agent can do."
        />
      )}
    </div>
  );
}
