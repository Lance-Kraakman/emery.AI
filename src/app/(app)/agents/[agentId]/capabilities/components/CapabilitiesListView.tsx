'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { CapabilityDTO } from '@/app/mappers/capability-mapper';
import { deleteCapability } from '@/app/actions/capabilities';
import { toast } from 'sonner';

interface CapabilitiesListViewProps {
  agent: AgentDTO;
  initialCapabilities: CapabilityDTO[];
}

export function CapabilitiesListView({
  agent,
  initialCapabilities
}: CapabilitiesListViewProps) {
  const router = useRouter();
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (capabilityId: number) => {
    if (!confirm('Are you sure you want to delete this capability? This action cannot be undone.')) {
      return;
    }

    setDeletingId(capabilityId);

    try {
      const result = await deleteCapability(capabilityId);

      if (result.success) {
        setCapabilities(capabilities.filter(c => c.id !== capabilityId));
        toast.success('Capability deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete capability');
      }
    } catch (error) {
      console.error('Error deleting capability:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/agents')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Capabilities</h1>
            <p className="text-muted-foreground mt-1">
              Agent: {agent.name}
            </p>
          </div>
        </div>
        <Button
          onClick={() => router.push(`/agents/${agent.id}/capabilities/new`)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Capability
        </Button>
      </div>

      {/* Capabilities Grid */}
      {capabilities.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-muted p-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No capabilities yet</h3>
              <p className="text-muted-foreground mt-1">
                Create your first capability to get started
              </p>
            </div>
            <Button
              onClick={() => router.push(`/agents/${agent.id}/capabilities/new`)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Capability
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(capability => (
            <Card
              key={capability.id}
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/agents/${agent.id}/capabilities/${capability.id}`)}
            >
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg line-clamp-1">
                    {capability.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {capability.description || 'No description'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {capability.steps.length} {capability.steps.length === 1 ? 'step' : 'steps'}
                  </Badge>
                  {capability.steps.some(s => s.type === 'TOOL_STEP') && (
                    <Badge variant="secondary">Tools</Badge>
                  )}
                  {capability.steps.some(s => s.type === 'CODE_STEP') && (
                    <Badge variant="secondary">Code</Badge>
                  )}
                </div>

                <div className="flex gap-2 pt-2" onClick={e => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/agents/${agent.id}/capabilities/${capability.id}`);
                    }}
                  >
                    <Edit className="h-3 w-3 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(capability.id);
                    }}
                    disabled={deletingId === capability.id}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
