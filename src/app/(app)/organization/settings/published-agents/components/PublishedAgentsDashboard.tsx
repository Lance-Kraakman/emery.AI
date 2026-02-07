'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Globe,
  Key,
  Loader2,
  PauseCircle,
  PlayCircle,
  Copy,
  Plus,
  ExternalLink,
  Search,
  RefreshCw,
  Trash2,
  CheckCircle,
} from "lucide-react";
import {
  getPublishedAgents,
  suspendPublishedAgent,
  resumePublishedAgent,
  getApiKeysForPublishedAgent,
  generateApiKey,
  revokeApiKey,
} from "@/app/actions/published-agents";
import type { PublishedAgentDTO, PublishedAgentApiKeyDTO } from "@/ddd/domain/published-agents/types";

const STATUS_COLORS = {
  draft: 'bg-muted text-muted-foreground border-border',
  pending_review: 'bg-warning/20 text-warning border-warning/30',
  approved: 'bg-primary/20 text-primary border-primary/30',
  published: 'bg-success/20 text-success border-success/30',
  suspended: 'bg-destructive/20 text-destructive border-destructive/30',
};

const GRADE_COLORS = {
  A: 'bg-success/20 text-success border-success/30',
  B: 'bg-primary/20 text-primary border-primary/30',
  C: 'bg-warning/20 text-warning border-warning/30',
};

export function PublishedAgentsDashboard() {
  const [agents, setAgents] = useState<PublishedAgentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Action states
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendingAgent, setSuspendingAgent] = useState<PublishedAgentDTO | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // API Keys dialog
  const [keysDialogOpen, setKeysDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<PublishedAgentDTO | null>(null);
  const [apiKeys, setApiKeys] = useState<PublishedAgentApiKeyDTO[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const result = await getPublishedAgents();
      if (result.success && result.data) {
        setAgents(result.data);
      }
    } catch (error) {
      console.error("Error loading published agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendingAgent || !suspendReason.trim()) return;

    setActionLoading(true);
    try {
      const result = await suspendPublishedAgent(suspendingAgent.id, suspendReason);
      if (result.success) {
        setSuspendDialogOpen(false);
        setSuspendingAgent(null);
        setSuspendReason('');
        loadAgents();
      } else {
        console.error("Failed to suspend agent:", result.error);
      }
    } catch (error) {
      console.error("Error suspending agent:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (agent: PublishedAgentDTO) => {
    setActionLoading(true);
    try {
      const result = await resumePublishedAgent(agent.id);
      if (result.success) {
        loadAgents();
      } else {
        console.error("Failed to resume agent:", result.error);
      }
    } catch (error) {
      console.error("Error resuming agent:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenKeys = async (agent: PublishedAgentDTO) => {
    setSelectedAgent(agent);
    setKeysDialogOpen(true);
    setKeysLoading(true);
    setGeneratedKey(null);
    setNewKeyName('');

    try {
      const result = await getApiKeysForPublishedAgent(agent.id);
      if (result.success && result.data) {
        setApiKeys(result.data);
      }
    } catch (error) {
      console.error("Error loading API keys:", error);
    } finally {
      setKeysLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!selectedAgent || !newKeyName.trim()) return;

    setKeysLoading(true);
    try {
      const result = await generateApiKey(selectedAgent.id, newKeyName);
      if (result.success && result.data) {
        setGeneratedKey(result.data.plaintextKey);
        setApiKeys([...apiKeys, result.data.apiKey]);
        setNewKeyName('');
      } else {
        console.error("Failed to generate API key:", result.error);
      }
    } catch (error) {
      console.error("Error generating API key:", error);
    } finally {
      setKeysLoading(false);
    }
  };

  const handleRevokeKey = async (keyId: number) => {
    setKeysLoading(true);
    try {
      const result = await revokeApiKey(keyId);
      if (result.success) {
        setApiKeys(apiKeys.filter(k => k.id !== keyId));
      } else {
        console.error("Failed to revoke API key:", result.error);
      }
    } catch (error) {
      console.error("Error revoking API key:", error);
    } finally {
      setKeysLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const columnHelper = createColumnHelper<PublishedAgentDTO>();

  const columns = useMemo(() => [
    columnHelper.accessor('displayName', {
      header: 'Agent',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.displayName}</span>
          <span className="text-xs text-muted-foreground">{row.original.slug}</span>
        </div>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: ({ getValue }) => {
        const status = getValue();
        return (
          <Badge className={`${STATUS_COLORS[status as keyof typeof STATUS_COLORS]} border`}>
            {status.replace('_', ' ')}
          </Badge>
        );
      },
    }),
    columnHelper.accessor('minSecurityGrade', {
      header: 'Min Grade',
      cell: ({ getValue }) => {
        const grade = getValue();
        return (
          <Badge className={`${GRADE_COLORS[grade as keyof typeof GRADE_COLORS]} border`}>
            {grade}
          </Badge>
        );
      },
    }),
    columnHelper.display({
      id: 'modes',
      header: 'Access Modes',
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.allowTaskMode && (
            <Badge variant="outline" className="text-xs">Task</Badge>
          )}
          {row.original.allowSkillMode && (
            <Badge variant="outline" className="text-xs">Skill</Badge>
          )}
        </div>
      ),
    }),
    columnHelper.accessor('publishedAt', {
      header: 'Published',
      cell: ({ getValue }) => {
        const date = getValue();
        return date ? (
          <span className="text-sm text-muted-foreground">
            {new Date(date).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const agent = row.original;
        return (
          <div className="flex items-center gap-2">
            {agent.status === 'published' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenKeys(agent)}
                  title="Manage API Keys"
                >
                  <Key className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSuspendingAgent(agent);
                    setSuspendDialogOpen(true);
                  }}
                  title="Suspend"
                  className="text-yellow-600 hover:text-yellow-700"
                >
                  <PauseCircle className="w-4 h-4" />
                </Button>
              </>
            )}
            {agent.status === 'suspended' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResume(agent)}
                title="Resume"
                className="text-green-600 hover:text-green-700"
              >
                <PlayCircle className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/v1/published/${agent.slug}/openapi.json`, '_blank')}
              title="View OpenAPI Spec"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    }),
  ], []);

  const filteredAgents = useMemo(() => {
    let result = agents;

    if (statusFilter !== 'all') {
      result = result.filter(a => a.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.displayName.toLowerCase().includes(query) ||
        a.slug.toLowerCase().includes(query)
      );
    }

    return result;
  }, [agents, statusFilter, searchQuery]);

  const table = useReactTable({
    data: filteredAgents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading published agents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6" />
            Published Agents
          </h1>
          <p className="text-muted-foreground">
            Manage agents exposed externally as callable services
          </p>
        </div>
        <Button onClick={loadAgents} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredAgents.length} Published Agent{filteredAgents.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAgents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No published agents found.</p>
              <p className="text-sm mt-1">
                Publish an agent from its detail page to see it here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Suspend Dialog */}
      <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Published Agent</AlertDialogTitle>
            <AlertDialogDescription>
              This will temporarily disable external access to &quot;{suspendingAgent?.displayName}&quot;.
              External API calls will return 404 until the agent is resumed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Reason for suspension</label>
            <Input
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g., Security review required, Maintenance"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspend}
              disabled={actionLoading || !suspendReason.trim()}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Suspend Agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* API Keys Dialog */}
      <Dialog open={keysDialogOpen} onOpenChange={setKeysDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Keys for {selectedAgent?.displayName}
            </DialogTitle>
            <DialogDescription>
              Manage API keys for external access to this agent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Generated Key Alert */}
            {generatedKey && (
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      API Key Generated Successfully
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Copy this key now. It won&apos;t be shown again.
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white dark:bg-gray-900 p-2 rounded border font-mono break-all">
                        {generatedKey}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(generatedKey)}
                      >
                        {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Existing Keys */}
            {keysLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No API keys found.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{key.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {key.keyPrefix}... | Created: {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsedAt && ` | Last used: ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRevokeKey(key.id)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Generate New Key */}
            <div className="border-t pt-4">
              <label className="text-sm font-medium">Generate New Key</label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Key name (e.g., Production, Test)"
                  className="flex-1"
                />
                <Button
                  onClick={handleGenerateKey}
                  disabled={keysLoading || !newKeyName.trim()}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
