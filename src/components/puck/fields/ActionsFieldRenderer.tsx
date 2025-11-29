'use client';

/**
 * ActionsFieldRenderer - Custom Puck field for configuring actions
 *
 * Improved UI for action configuration with:
 * - Agent selector dropdown for task assignment
 * - Task instructions dialog with UnifiedChatInput (isolated from Puck re-renders)
 * - Page selector dropdown for navigation
 * - URL input with "Open in New Tab" checkbox
 */

import React, { useState, useEffect } from 'react';
import { FieldLabel } from '@measured/puck';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Bot, FileText, ExternalLink, GripVertical, Settings2 } from 'lucide-react';
import type { Action } from '../types/actions';
import type { TaskInstructions } from '@/ddd/domain/tasks/entities/task';
import type { PageDTO } from '@/app/mappers/puck-page-mapper';
import type { AgentDTO } from '@/app/dtos/agent.dto';
import { getPages } from '@/app/actions/puck-pages';
import { getAgents } from '@/app/actions/agents';
import { TaskInstructionsDialog } from './TaskInstructionsDialog';
import { VariableAutocompleteInput } from './VariableAutocompleteInput';

type ActionType = 'assignTask' | 'navigateToPage' | 'openUrl';

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  assignTask: 'Assign Task to Agent',
  navigateToPage: 'Navigate to Page',
  openUrl: 'Open URL',
};

const ACTION_TYPE_ICONS: Record<ActionType, React.ReactNode> = {
  assignTask: <Bot className="h-4 w-4" />,
  navigateToPage: <FileText className="h-4 w-4" />,
  openUrl: <ExternalLink className="h-4 w-4" />,
};

interface ActionsFieldProps {
  value?: Action[];
  onChange: (value: Action[]) => void;
  field: { label?: string };
  name: string;
  readOnly?: boolean;
}

/**
 * QueryParamsEditor - Mini editor for key-value query parameters
 * Each value supports variable autocomplete
 */
function QueryParamsEditor({
  value,
  onChange,
  disabled,
}: {
  value: Record<string, string | number | string[]>;
  onChange: (value: Record<string, string | number | string[]>) => void;
  disabled?: boolean;
}) {
  const entries = Object.entries(value);

  const addParam = () => {
    const newKey = `param${entries.length + 1}`;
    onChange({ ...value, [newKey]: '' });
  };

  const updateKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const newValue = { ...value };
    delete newValue[oldKey];
    newValue[newKey] = value[oldKey];
    onChange(newValue);
  };

  const updateValue = (key: string, newVal: string) => {
    onChange({ ...value, [key]: newVal });
  };

  const removeParam = (key: string) => {
    const newValue = { ...value };
    delete newValue[key];
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No query parameters
        </p>
      )}

      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center gap-2">
          <Input
            value={key}
            onChange={(e) => updateKey(key, e.target.value)}
            placeholder="param"
            className="w-24 text-xs"
            disabled={disabled}
          />
          <span className="text-muted-foreground">=</span>
          <VariableAutocompleteInput
            value={String(val)}
            onChange={(newVal) => updateValue(key, newVal)}
            placeholder="{id}"
            className="flex-1 text-xs"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeParam(key)}
            disabled={disabled}
            className="h-8 w-8 p-0"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addParam}
        disabled={disabled}
        className="w-full text-xs"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Parameter
      </Button>

      <p className="text-xs text-muted-foreground">
        Type {"{"} in values to insert row data or query parameters
      </p>
    </div>
  );
}

function ActionItem({
  action,
  index,
  onChange,
  onRemove,
  onConfigureTask,
  pages,
  agents,
  loadingPages,
  loadingAgents,
  readOnly,
}: {
  action: Action;
  index: number;
  onChange: (action: Action) => void;
  onRemove: () => void;
  onConfigureTask: () => void;
  pages: PageDTO[];
  agents: AgentDTO[];
  loadingPages: boolean;
  loadingAgents: boolean;
  readOnly?: boolean;
}) {
  const actionType = action.type as ActionType;

  const handleTypeChange = (newType: ActionType) => {
    // Reset to defaults for the new type
    switch (newType) {
      case 'assignTask':
        onChange({
          type: 'assignTask',
          agentId: 0,
          taskInstructions: { task: '' },
        });
        break;
      case 'navigateToPage':
        onChange({
          type: 'navigateToPage',
          pageId: '',
        });
        break;
      case 'openUrl':
        onChange({
          type: 'openUrl',
          url: '',
          newTab: true,
        });
        break;
    }
  };

  const getPreview = (): string => {
    switch (action.type) {
      case 'assignTask': {
        const agent = agents.find(a => a.id === action.agentId);
        const agentName = agent?.name || `Agent #${action.agentId}`;
        const taskPreview = action.taskInstructions?.task?.slice(0, 50) || 'No task';
        return `Assign to ${agentName}: "${taskPreview}${action.taskInstructions?.task?.length > 50 ? '...' : ''}"`;
      }
      case 'navigateToPage': {
        const page = pages.find(p => p.id.toString() === action.pageId);
        return page ? `Go to: ${page.name}` : 'No page selected';
      }
      case 'openUrl':
        return action.url ? `Open: ${action.url}${action.newTab ? ' (new tab)' : ''}` : 'No URL specified';
      default:
        return 'Unknown action';
    }
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-3 bg-background">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <GripVertical className="h-4 w-4" />
          <span className="text-xs font-medium">Action {index + 1}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={readOnly}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Action Type Selector */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Action Type</Label>
        <Select
          value={actionType}
          onValueChange={(val) => handleTypeChange(val as ActionType)}
          disabled={readOnly}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ACTION_TYPE_LABELS) as ActionType[]).map((type) => (
              <SelectItem key={type} value={type}>
                <div className="flex items-center gap-2">
                  {ACTION_TYPE_ICONS[type]}
                  <span>{ACTION_TYPE_LABELS[type]}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Assign Task Fields */}
      {action.type === 'assignTask' && (
        <>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Agent</Label>
            <Select
              value={action.agentId?.toString() || ''}
              onValueChange={(val) =>
                onChange({ ...action, agentId: parseInt(val) })
              }
              disabled={readOnly || loadingAgents}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingAgents
                      ? 'Loading agents...'
                      : agents.length === 0
                      ? 'No agents available'
                      : 'Select an agent'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <span>{agent.name}</span>
                      {agent.role && (
                        <span className="text-xs text-muted-foreground">
                          ({agent.role})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Task Instructions Preview + Configure Button */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Task Instructions</Label>
            <div className="border border-border rounded-md p-3 bg-muted/30">
              {action.taskInstructions?.task ? (
                <p className="text-sm text-foreground line-clamp-3">
                  {action.taskInstructions.task}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No task instructions configured
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onConfigureTask}
                disabled={readOnly}
                className="mt-2 w-full"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Configure Task
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: Use {"{fieldName}"} to include data from the current row
            </p>
          </div>
        </>
      )}

      {/* Navigate to Page Fields */}
      {action.type === 'navigateToPage' && (
        <>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Select Page</Label>
            <Select
              value={action.pageId?.toString() || ''}
              onValueChange={(val) => onChange({ ...action, pageId: val })}
              disabled={readOnly || loadingPages}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingPages
                      ? 'Loading pages...'
                      : pages.length === 0
                      ? 'No pages available'
                      : 'Select a page'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {pages.map((page) => (
                  <SelectItem key={page.id} value={page.id.toString()}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{page.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({page.slug})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Query Parameters */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Query Parameters</Label>
            <QueryParamsEditor
              value={action.queryParams || {}}
              onChange={(queryParams) => onChange({ ...action, queryParams })}
              disabled={readOnly}
            />
          </div>
        </>
      )}

      {/* Open URL Fields */}
      {action.type === 'openUrl' && (
        <>
          <div className="space-y-2">
            <Label className="text-xs font-medium">URL</Label>
            <VariableAutocompleteInput
              value={action.url || ''}
              onChange={(url) => onChange({ ...action, url })}
              placeholder="https://example.com/{id}"
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground">
              Type {"{"} to insert row data or query parameters
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`action-${index}-new-tab`}
              checked={action.newTab || false}
              onCheckedChange={(checked) =>
                onChange({ ...action, newTab: checked as boolean })
              }
              disabled={readOnly}
            />
            <Label
              htmlFor={`action-${index}-new-tab`}
              className="text-xs font-normal cursor-pointer"
            >
              Open in new tab
            </Label>
          </div>
        </>
      )}

      {/* Preview */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground truncate">{getPreview()}</p>
      </div>
    </div>
  );
}

export function ActionsFieldRenderer({
  value,
  onChange,
  field,
  name,
  readOnly = false,
}: ActionsFieldProps) {
  const params = useParams();
  const appId = params?.id ? parseInt(params.id as string) : null;

  const [pages, setPages] = useState<PageDTO[]>([]);
  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Dialog state managed at parent level to avoid re-render loops
  const [taskDialogIndex, setTaskDialogIndex] = useState<number | null>(null);

  const actions = value || [];

  // Load pages when component mounts
  useEffect(() => {
    if (appId) {
      loadPages();
    }
  }, [appId]);

  // Load agents when component mounts
  useEffect(() => {
    loadAgentsList();
  }, []);

  const loadPages = async () => {
    if (!appId) return;
    try {
      setLoadingPages(true);
      const result = await getPages(appId);
      if (result.success && result.data) {
        setPages(result.data);
      }
    } catch (error) {
      console.error('Error loading pages:', error);
    } finally {
      setLoadingPages(false);
    }
  };

  const loadAgentsList = async () => {
    try {
      setLoadingAgents(true);
      const result = await getAgents({ status: 'active' });
      setAgents(result);
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

  const addAction = () => {
    const newAction: Action = {
      type: 'navigateToPage',
      pageId: '',
    };
    onChange([...actions, newAction]);
  };

  const updateAction = (index: number, action: Action) => {
    const newActions = [...actions];
    newActions[index] = action;
    onChange(newActions);
  };

  const removeAction = (index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    onChange(newActions);
  };

  const handleTaskInstructionsSave = (instructions: TaskInstructions) => {
    if (taskDialogIndex === null) return;
    const action = actions[taskDialogIndex];
    if (action?.type === 'assignTask') {
      updateAction(taskDialogIndex, {
        ...action,
        taskInstructions: instructions,
      });
    }
    setTaskDialogIndex(null);
  };

  const getAgentName = (index: number) => {
    const action = actions[index];
    if (action?.type !== 'assignTask') return undefined;
    const agent = agents.find((a) => a.id === action.agentId);
    return agent?.name;
  };

  return (
    <FieldLabel label={field.label || 'Actions'}>
      <div className="space-y-3">
        {actions.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            No actions configured. Add an action to define what happens on click.
          </p>
        )}

        {actions.map((action, index) => (
          <ActionItem
            key={index}
            action={action}
            index={index}
            onChange={(updated) => updateAction(index, updated)}
            onRemove={() => removeAction(index)}
            onConfigureTask={() => setTaskDialogIndex(index)}
            pages={pages}
            agents={agents}
            loadingPages={loadingPages}
            loadingAgents={loadingAgents}
            readOnly={readOnly}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addAction}
          disabled={readOnly}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Action
        </Button>
      </div>

      {/* Task Instructions Dialog - rendered at parent level */}
      {taskDialogIndex !== null && actions[taskDialogIndex]?.type === 'assignTask' && (
        <TaskInstructionsDialog
          isOpen={true}
          onClose={() => setTaskDialogIndex(null)}
          value={actions[taskDialogIndex].taskInstructions || { task: '' }}
          onSave={handleTaskInstructionsSave}
          agentName={getAgentName(taskDialogIndex)}
        />
      )}
    </FieldLabel>
  );
}
