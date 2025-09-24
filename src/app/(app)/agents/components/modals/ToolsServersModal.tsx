'use client';

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Wrench,
  Server,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  Search,
  Check,
  Globe,
  Database,
  FileText,
  Bot
} from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import type { ServerConfig } from '@/ddd/domain/agents/entities/agent';
import { updateAgentFromClient } from '@/app/actions/agents';
import { ToolDropdown } from '@/components/chat/ToolDropdown';
import type { ToolDTO } from '@/app/mappers/tool-mapper';

interface ToolsServersModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
  onUpdate?: () => void;
}

type TabValue = 'tools' | 'servers';

export function ToolsServersModal({ isOpen, onClose, agent, onUpdate }: ToolsServersModalProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('tools');
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Tool selection state
  const [showToolDropdown, setShowToolDropdown] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [toolSearchRef, setToolSearchRef] = useState<HTMLInputElement | null>(null);

  // Server form state
  const [newServerName, setNewServerName] = useState('');
  const [newServerEndpoint, setNewServerEndpoint] = useState('');

  // Initialize tools and servers
  useEffect(() => {
    if (isOpen) {
      setTools((agent.tools as ToolConfig[]) || []);
      setServers((agent.servers as ServerConfig[]) || []);
      setActiveTab('tools');
    }
  }, [isOpen, agent]);

  const handleAddSelectedTool = (selectedTool: ToolDTO) => {
    const toolName = selectedTool.insertText || `@tool:${selectedTool.name}`;

    // Check if tool already exists
    const exists = tools.some(tool => tool.name === toolName);
    if (exists) return;

    const newTool = ToolConfig.create(toolName, {});
    setTools([...tools, newTool]);
    setShowToolDropdown(false);
    setDropdownQuery('');
  };

  const handleRemoveTool = (index: number) => {
    setTools(tools.filter((_, i) => i !== index));
  };

  const handleToolSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDropdownQuery(value);

    if (value.startsWith('@') || value.trim().length > 0) {
      setShowToolDropdown(true);

      // Position dropdown
      if (toolSearchRef) {
        const rect = toolSearchRef.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left
        });
      }
    } else {
      setShowToolDropdown(false);
    }
  };

  const handleAddServer = () => {
    if (!newServerName.trim()) return;

    const newServer: ServerConfig = {
      name: newServerName.trim(),
      endpoint: newServerEndpoint.trim() || undefined,
      config: {}
    };

    setServers([...servers, newServer]);
    setNewServerName('');
    setNewServerEndpoint('');
  };

  const handleRemoveServer = (index: number) => {
    setServers(servers.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const result = await updateAgentFromClient(agent.id, {
        tools,
        servers
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update tools and servers');
      }

      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error saving tools and servers:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getToolIcon = (toolName: string) => {
    if (toolName.includes('@doc:')) return FileText;
    if (toolName.includes('@agent:')) return Bot;
    if (toolName.includes('@database:')) return Database;
    if (toolName.includes('@table:')) return Database;
    return Wrench;
  };

  const footer = (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        {tools.length} tool{tools.length !== 1 ? 's' : ''} • {servers.length} server{servers.length !== 1 ? 's' : ''}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Tools & Servers"
      description="Configure external tools and server connections for this agent"
      size="lg"
      footer={footer}
      closeOnEscape={!isSaving}
      closeOnOutsideClick={!isSaving}
    >
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Tools ({tools.length})
            </TabsTrigger>
            <TabsTrigger value="servers" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Servers ({servers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tools" className="space-y-4 mt-6">
            {/* Tool Search */}
            <div className="space-y-2">
              <Label htmlFor="tool-search">Add Tools</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tool-search"
                  ref={setToolSearchRef}
                  value={dropdownQuery}
                  onChange={handleToolSearch}
                  placeholder="Search tools, type @ for references..."
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Search for tools or type @ to browse documents, agents, and databases
              </p>
            </div>

            {/* Selected Tools */}
            <div className="space-y-3">
              <h3 className="font-medium">Selected Tools ({tools.length})</h3>

              {tools.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No tools selected. Use the search above to add tools.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {tools.map((tool, index) => {
                    const Icon = getToolIcon(tool.name);
                    return (
                      <Card key={index}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-muted rounded-md">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <div className="font-medium text-sm">{tool.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  Config: {JSON.stringify(tool.config)}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTool(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="servers" className="space-y-4 mt-6">
            {/* Add Server Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add New Server</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="server-name">Server Name *</Label>
                    <Input
                      id="server-name"
                      value={newServerName}
                      onChange={(e) => setNewServerName(e.target.value)}
                      placeholder="e.g., Production API, Dev Database"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="server-endpoint">Endpoint (Optional)</Label>
                    <Input
                      id="server-endpoint"
                      value={newServerEndpoint}
                      onChange={(e) => setNewServerEndpoint(e.target.value)}
                      placeholder="https://api.example.com"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddServer}
                  disabled={!newServerName.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Server
                </Button>
              </CardContent>
            </Card>

            {/* Server List */}
            <div className="space-y-3">
              <h3 className="font-medium">Configured Servers ({servers.length})</h3>

              {servers.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Server className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No servers configured. Add a server above to get started.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {servers.map((server, index) => (
                    <Card key={index}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-md">
                              <Server className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{server.name}</div>
                              {server.endpoint && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  {server.endpoint}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {server.endpoint ? 'Configured' : 'Named Only'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveServer(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Tool Dropdown */}
        <ToolDropdown
          query={dropdownQuery}
          isOpen={showToolDropdown}
          onClose={() => setShowToolDropdown(false)}
          onSelect={handleAddSelectedTool}
          position={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            maxHeight: 300,
          }}
        />
      </div>
    </BaseModal>
  );
}