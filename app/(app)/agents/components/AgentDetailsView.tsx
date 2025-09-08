'use client';

import { useState } from 'react';
import { Edit, ChevronDown, ChevronRight, Activity, Cog, Save, X, Loader2 } from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateAgentFromClient } from '@/app/actions/agents';
import CapabilityManager from './CapabilityManager';
import AgentActivityPanel from './AgentActivityPanel';

// AIDEV-NOTE: Agent details view with inline editing functionality

interface AgentDetailsViewProps {
  agent: AgentDTO;
  onEdit: () => void;
  onUpdate?: () => void;
}

interface EditFormData {
  name: string;
  role: string;
  description: string;
  persona: string;
  status: string;
}

export default function AgentDetailsView({ agent, onEdit, onUpdate }: AgentDetailsViewProps) {
  const [isCapabilitiesOpen, setIsCapabilitiesOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: agent.name || '',
    role: agent.role || '',
    description: agent.description || '',
    persona: agent.persona || '',
    status: agent.status || 'active'
  });

  const handleEdit = () => {
    setIsEditMode(true);
    setEditFormData({
      name: agent.name || '',
      role: agent.role || '',
      description: agent.description || '',
      persona: agent.persona || '',
      status: agent.status || 'active'
    });
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditFormData({
      name: agent.name || '',
      role: agent.role || '',
      description: agent.description || '',
      persona: agent.persona || '',
      status: agent.status || 'active'
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const updatedAgent = {
        ...agent,
        name: editFormData.name.trim(),
        role: editFormData.role.trim(),
        description: editFormData.description.trim(),
        persona: editFormData.persona.trim(),
        status: editFormData.status
      };

      const result = await updateAgentFromClient(agent.id, {
        name: editFormData.name.trim(),
        role: editFormData.role.trim(),
        description: editFormData.description.trim(),
        persona: editFormData.persona.trim(),
        status: editFormData.status
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update agent');
      }
      
      setIsEditMode(false);
      onUpdate?.();
      
    } catch (error) {
      console.error('Error updating agent:', error);
      // Simple alert for now - could be replaced with a toast system later
      alert(error instanceof Error ? error.message : 'An error occurred while updating the agent');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof EditFormData, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4 max-h-full overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-start sticky top-0 bg-background z-10 pb-4">
        <div className="space-y-1 flex-1 mr-4">
          {isEditMode ? (
            <>
              <Input
                value={editFormData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="text-2xl font-bold h-auto p-1 border-none shadow-none bg-transparent"
                placeholder="Agent name"
              />
              <Input
                value={editFormData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                className="text-muted-foreground h-auto p-1 border-none shadow-none bg-transparent"
                placeholder="Role"
              />
              <Select value={editFormData.status} onValueChange={(value) => handleInputChange('status', value)}>
                <SelectTrigger className="w-fit h-auto p-1 border-none shadow-none bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold">{agent.name}</h2>
              {agent.role && (
                <p className="text-muted-foreground">{agent.role}</p>
              )}
              {agent.status && (
                <Badge variant={agent.status === 'active' ? 'success' : 'secondary'}>
                  {agent.status}
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <Button
                onClick={handleCancel}
                variant="outline"
                size="sm"
                disabled={isSaving}
              >
                <X size={16} />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                disabled={isSaving || !editFormData.name.trim()}
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save
              </Button>
            </>
          ) : (
            <Button
              onClick={handleEdit}
              variant="outline"
              size="sm"
            >
              <Edit size={16} />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Overview Section */}
      <Card className={isEditMode ? 'ring-2 ring-primary/20' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-foreground mb-2">Description</h4>
            {isEditMode ? (
              <Textarea
                value={editFormData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="text-sm"
                placeholder="Agent description"
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {agent.description || 'No description provided'}
              </p>
            )}
          </div>
          
          <div>
            <h4 className="font-medium text-foreground mb-2">Persona</h4>
            {isEditMode ? (
              <Textarea
                value={editFormData.persona}
                onChange={(e) => handleInputChange('persona', e.target.value)}
                className="text-sm"
                placeholder="Agent persona"
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {agent.persona || 'No persona defined'}
              </p>
            )}
          </div>
          
          {/* Tools and Servers in a grid - View only for now */}
          <div className="grid gap-4 md:grid-cols-2">
            {agent.tools && Array.isArray(agent.tools) && agent.tools.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-2">Tools</h4>
                <div className="flex flex-wrap gap-1">
                  {agent.tools.slice(0, 5).map((tool: any, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {typeof tool === 'string' ? tool : tool.name || 'Unknown'}
                    </Badge>
                  ))}
                  {agent.tools.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{agent.tools.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
            
            {agent.servers && Array.isArray(agent.servers) && agent.servers.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-2">Servers</h4>
                <div className="flex flex-wrap gap-1">
                  {agent.servers.slice(0, 5).map((server: any, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {typeof server === 'string' ? server : server.name || 'Unknown'}
                    </Badge>
                  ))}
                  {agent.servers.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{agent.servers.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Capabilities Section - Collapsible */}
      <Collapsible open={isCapabilitiesOpen} onOpenChange={setIsCapabilitiesOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <Cog size={18} />
                  Capabilities
                </div>
                {isCapabilitiesOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <CapabilityManager agent={agent} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Recent Activity Section - Collapsible */}
      <Collapsible open={isActivityOpen} onOpenChange={setIsActivityOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <Activity size={18} />
                  Recent Activity
                </div>
                {isActivityOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <AgentActivityPanel agent={agent} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
