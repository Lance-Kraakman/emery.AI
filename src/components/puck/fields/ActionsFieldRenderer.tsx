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

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Plus, Trash2, Bot, FileText, ExternalLink, GripVertical, Settings2, Variable as VariableIcon } from 'lucide-react';
import type { Action } from '../types/actions';
import type { TaskInstructions } from '@/ddd/domain/tasks/entities/task';
import type { PageDTO } from '@/app/mappers/puck-page-mapper';
import type { AgentDTO } from '@/app/dtos/agent.dto';
import { getPages } from '@/app/actions/puck-pages';
import { getAgents } from '@/app/actions/agents';
import { TaskInstructionsDialog } from './TaskInstructionsDialog';
import { VariableAutocompleteInput } from './VariableAutocompleteInput';
import { VariablesPanel, type Variable } from '@/components/shared/VariablesPanel';
import { useDataLayoutContext } from '../contexts/DataLayoutContext';
import { useStateContext } from '../contexts/StateContext';
import type { StateVariableType, StateVariable } from '../types/state';
import { isArrayFieldType } from '@/ddd/domain/tables/value-objects/table-field';

type ActionType = 'assignTask' | 'navigateToPage' | 'openUrl' | 'setState';

/**
 * StateValueInput - Type-aware value input for setState action
 *
 * Shows appropriate input based on the selected state variable type:
 * - Boolean: True/False/Clear dropdown
 * - Number: Number input with variable autocomplete
 * - String/other: Text input with variable autocomplete
 */
function StateValueInput({
  value,
  onChange,
  variableType,
  disabled,
}: {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  variableType?: StateVariableType;
  disabled?: boolean;
}) {
  // Boolean type - show True/False/Clear dropdown
  if (variableType === 'boolean') {
    return (
      <Select
        value={value ?? ''}
        onValueChange={(val) => onChange(val === '__null__' ? null : val)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select value...">
            {value === 'true' ? 'True' : value === 'false' ? 'False' : value === '' || value === null ? 'Clear (null)' : value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">
            <span className="text-green-600 font-medium">True</span>
          </SelectItem>
          <SelectItem value="false">
            <span className="text-red-600 font-medium">False</span>
          </SelectItem>
          <SelectItem value="__null__">
            <span className="text-muted-foreground">Clear (null)</span>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // Number type - show number input or variable autocomplete
  if (variableType === 'number') {
    // Check if value looks like a variable reference
    const isVariable = value?.includes('{');
    if (isVariable) {
      return (
        <VariableAutocompleteInput
          value={value ?? ''}
          onChange={(val) => onChange(val)}
          placeholder="Enter number or {{rowData.field}}"
          disabled={disabled}
        />
      );
    }

    return (
      <div className="space-y-1">
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter a number"
          disabled={disabled}
        />
        <p className="text-[10px] text-muted-foreground">
          Type {"{{"} for variable reference
        </p>
      </div>
    );
  }

  // Default: text input with variable autocomplete
  return (
    <VariableAutocompleteInput
      value={value ?? ''}
      onChange={(val) => onChange(val)}
      placeholder="Enter value or {{rowData.field}}"
      disabled={disabled}
    />
  );
}

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  assignTask: 'Assign Task to Agent',
  navigateToPage: 'Navigate to Page',
  openUrl: 'Open URL',
  setState: 'Set State Variable',
};

const ACTION_TYPE_ICONS: Record<ActionType, React.ReactNode> = {
  assignTask: <Bot className="h-4 w-4" />,
  navigateToPage: <FileText className="h-4 w-4" />,
  openUrl: <ExternalLink className="h-4 w-4" />,
  setState: <VariableIcon className="h-4 w-4" />,
};

interface ActionsFieldProps {
  value?: Action[];
  onChange: (value: Action[]) => void;
  field: { label?: string };
  name: string;
  readOnly?: boolean;
}

/**
 * PageVariablesEditor - Key-value editor with click-to-insert variables panel
 * Uses the same UI pattern as TriggerConfigModal for consistency
 */
function PageVariablesEditor({
  value,
  onChange,
  disabled,
}: {
  value: Record<string, string | number | string[]>;
  onChange: (value: Record<string, string | number | string[]>) => void;
  disabled?: boolean;
}) {
  const entries = Object.entries(value);
  const dataContext = useDataLayoutContext();
  const stateContext = useStateContext();
  const pageStateConfig = stateContext?.getConfig();

  // Track which input was last focused for variable insertion (by index, not key name)
  const lastFocusedIndexRef = useRef<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Keep refs to current value and entries to avoid stale closures
  const valueRef = useRef(value);
  const entriesRef = useRef(entries);
  valueRef.current = value;
  entriesRef.current = entries;

  // Build available variables list
  const availableVariables: Variable[] = [];

  // Add id field first if available
  if (dataContext?.sampleRow?.id !== undefined) {
    availableVariables.push({
      name: 'rowData.id',
      sampleValue: String(dataContext.sampleRow.id),
    });
  }

  // Add row fields from DataLayoutContext (skip 'id' since we added it above)
  if (dataContext?.fields) {
    for (const field of dataContext.fields) {
      if (field.name === 'id') continue; // Already added from sampleRow.id
      const sampleValue = dataContext.sampleRow?.[field.name];
      availableVariables.push({
        name: `rowData.${field.name}`,
        sampleValue: sampleValue !== undefined ? String(sampleValue) : undefined,
      });
    }
  }

  // Add state variables (which auto-populate from matching URL params)
  if (pageStateConfig?.variables) {
    for (const variable of pageStateConfig.variables) {
      availableVariables.push({
        name: `state.${variable.name}`,
        description: variable.description || `${variable.type} variable`,
      });
    }
  }

  // Add context variables (available when triggered from document/file fields)
  availableVariables.push({
    name: 'documentId',
    description: 'ID of clicked document (when triggered from document field)',
  });
  availableVariables.push({
    name: 'documentName',
    description: 'Name of clicked document (when triggered from document field)',
  });
  availableVariables.push({
    name: 'fileId',
    description: 'ID of clicked file (when triggered from file field)',
  });
  availableVariables.push({
    name: 'fileName',
    description: 'Name of clicked file (when triggered from file field)',
  });

  const addVariable = useCallback(() => {
    const newKey = `var${entries.length + 1}`;
    const newIndex = entries.length; // This will be the index of the new entry
    onChange({ ...value, [newKey]: '' });
    // Auto-focus the new entry's value input after render
    setTimeout(() => {
      const input = inputRefs.current[newIndex];
      if (input) {
        input.focus();
        lastFocusedIndexRef.current = newIndex;
      }
    }, 0);
  }, [entries.length, value, onChange]);

  const updateKey = useCallback((oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const newValue = { ...value };
    delete newValue[oldKey];
    newValue[newKey] = value[oldKey];
    onChange(newValue);
  }, [value, onChange]);

  const updateValue = useCallback((key: string, newVal: string) => {
    onChange({ ...value, [key]: newVal });
  }, [value, onChange]);

  const removeVariable = useCallback((key: string) => {
    const newValue = { ...value };
    delete newValue[key];
    onChange(newValue);
  }, [value, onChange]);

  // Insert variable into last focused input at cursor position
  // Uses refs to avoid stale closure issues
  const handleInsertVariable = useCallback((formattedVar: string) => {
    const currentEntries = entriesRef.current;
    const currentValue = valueRef.current;

    // Default to first entry if no input was explicitly focused
    let index = lastFocusedIndexRef.current;
    if (index === null && currentEntries.length > 0) {
      index = 0;
    }

    if (index === null || index >= currentEntries.length) {
      return;
    }

    const input = inputRefs.current[index];
    if (!input) {
      return;
    }

    const key = currentEntries[index][0];
    const existingValue = String(currentValue[key] || '');
    const start = input.selectionStart ?? existingValue.length;
    const end = input.selectionEnd ?? existingValue.length;

    const newValue = existingValue.slice(0, start) + formattedVar + existingValue.slice(end);
    onChange({ ...currentValue, [key]: newValue });

    // Restore focus and set cursor after inserted variable
    setTimeout(() => {
      input.focus();
      const newCursor = start + formattedVar.length;
      input.setSelectionRange(newCursor, newCursor);
    }, 0);
  }, [onChange]);

  return (
    <div className="space-y-3">
      {/* Variable entries */}
      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No variables
          </p>
        )}

        {entries.map(([key, val], index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={key}
              onChange={(e) => updateKey(key, e.target.value)}
              placeholder="name"
              className="w-24 text-xs"
              disabled={disabled}
            />
            <span className="text-muted-foreground">=</span>
            <Input
              ref={(el) => { inputRefs.current[index] = el; }}
              value={String(val)}
              onChange={(e) => updateValue(key, e.target.value)}
              onFocus={() => {
                lastFocusedIndexRef.current = index;
              }}
              placeholder="{{id}}"
              className="flex-1 text-xs font-mono"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeVariable(key)}
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
          onClick={addVariable}
          disabled={disabled}
          className="w-full text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Variable
        </Button>
      </div>

      {/* Clickable variables panel */}
      {entries.length > 0 && availableVariables.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Click to insert into focused value field:
          </p>
          <VariablesPanel
            variables={availableVariables}
            onInsert={handleInsertVariable}
            maxHeight="120px"
            emptyMessage="No variables available"
          />
        </div>
      )}
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
  const stateContext = useStateContext();
  const dataContext = useDataLayoutContext();

  // Track if mousedown happened on the delete button to prevent accidental deletion
  // from Puck's focus management system which can focus+click buttons unexpectedly
  const mouseDownOnDeleteRef = useRef(false);

  // Check if setState value references an array-type field (relation/file/document/multi-select)
  // Must be at top level to comply with React hooks rules
  const isArrayTypeField = React.useMemo(() => {
    if (action.type !== 'setState' || !('value' in action)) return false;
    const valueStr = String(action.value ?? '');
    const match = valueStr.match(/\{rowData\.(\w+)\}/);
    if (!match) return false;
    const fieldName = match[1];
    if (!dataContext?.fields) return false;
    const field = dataContext.fields.find(f => f.name === fieldName);
    return field ? isArrayFieldType(field.type) : false;
  }, [action, dataContext?.fields]);

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
      case 'setState':
        onChange({
          type: 'setState',
          key: '',
          value: '',
          updateUrl: true,
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
      case 'setState':
        return action.key ? `Set ${action.key} = ${action.value}${action.updateUrl !== false ? ' (URL)' : ''}` : 'No variable selected';
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
        <button
          type="button"
          onMouseDown={(e) => {
            mouseDownOnDeleteRef.current = true;
            e.stopPropagation();
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
          }}
          onBlur={() => {
            // Reset mousedown flag when button loses focus (prevents stale state)
            mouseDownOnDeleteRef.current = false;
          }}
          onClick={(e) => {
            e.stopPropagation();
            // Only delete if there was a real mousedown on this button
            if (mouseDownOnDeleteRef.current) {
              onRemove();
            }
            mouseDownOnDeleteRef.current = false;
          }}
          disabled={readOnly}
          className="h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground bg-transparent hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
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
              Tip: Use {"{{fieldName}}"} to include data from the current row
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
              onValueChange={(val) => {
                const selectedPage = pages.find(p => p.id.toString() === val);
                const queryParams: Record<string, string> = {};

                // Auto-populate from page's state variables
                // Try to match variable name to a field (case-insensitive), else leave empty
                if (selectedPage?.pageState?.variables) {
                  for (const variable of selectedPage.pageState.variables) {
                    const varNameLower = variable.name.toLowerCase();
                    // Check if there's a matching field name (e.g., "id" -> "{rowData.id}")
                    // This handles common cases like id, client_id, etc.
                    queryParams[variable.name] = `{{rowData.${varNameLower}}}`;
                  }
                }

                onChange({ ...action, pageId: val, queryParams });
              }}
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

          {/* Page Variables */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Pass Variables</Label>
            <PageVariablesEditor
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
              placeholder="https://example.com/{{id}}"
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground">
              Type {"{{"} to insert row data or page variables
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

      {/* Set State Fields */}
      {action.type === 'setState' && (
        <>
          <div className="space-y-2">
            <Label className="text-xs font-medium">State Variable</Label>
            <Select
              value={action.key || ''}
              onValueChange={(val) => {
                // Reset value when variable changes (type might differ)
                const newVar = stateContext?.getConfig()?.variables?.find(v => v.name === val);
                const newValue = newVar?.type === 'boolean' ? '' : action.value;
                onChange({ ...action, key: val, value: newValue });
              }}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a state variable" />
              </SelectTrigger>
              <SelectContent>
                {stateContext?.getConfig()?.variables?.length === 0 && (
                  <div className="py-2 px-2 text-xs text-muted-foreground">
                    No state variables defined
                  </div>
                )}
                {stateContext?.getConfig()?.variables?.map((variable) => (
                  <SelectItem key={variable.name} value={variable.name}>
                    <div className="flex items-center gap-2">
                      <VariableIcon className="h-4 w-4 text-muted-foreground" />
                      <span>{variable.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({variable.type})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define state variables in Page State panel
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Value</Label>
            <StateValueInput
              value={action.value as string | null | undefined}
              onChange={(val) => onChange({ ...action, value: val })}
              variableType={stateContext?.getConfig()?.variables?.find(v => v.name === action.key)?.type}
              disabled={readOnly}
            />
            {stateContext?.getConfig()?.variables?.find(v => v.name === action.key)?.type !== 'boolean' && (
              <p className="text-xs text-muted-foreground">
                Type {"{{"} to insert row data or other variables
              </p>
            )}
          </div>

          {/* Extract Mode selector for array-type fields (relation/file/document/multi-select) */}
          {isArrayTypeField && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Extract from array</Label>
              <Select
                value={action.extractMode || 'first'}
                onValueChange={(val) => onChange({ ...action, extractMode: val as 'first' | 'all' })}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">
                    <div className="flex items-center gap-2">
                      <span>First item only</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">ID</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <span>All items</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">[array]</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This field contains multiple items. Choose how to extract the value.
              </p>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id={`action-${index}-update-url`}
              checked={action.updateUrl !== false}
              onCheckedChange={(checked) =>
                onChange({ ...action, updateUrl: checked as boolean })
              }
              disabled={readOnly}
            />
            <Label
              htmlFor={`action-${index}-update-url`}
              className="text-xs font-normal cursor-pointer"
            >
              Update URL parameter (persists state in URL)
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
