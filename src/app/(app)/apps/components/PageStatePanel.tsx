/**
 * PageStatePanel - Configure page-level client state
 *
 * AIDEV-NOTE: Allows defining state variables for a page.
 * These are accessible via {{state.variableName}} in text interpolation
 * and in ConditionalBlock/DialogBlock configuration.
 *
 * State auto-populates from URL params with matching names.
 * Boolean variables can be used for dialogs, toggles, etc.
 */

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, X, Box } from "lucide-react";
import { toast } from "sonner";
import type { PageStateConfig, StateVariable, StatePersistence, StateVariableType } from "@/components/puck/types/state";

export interface PageStatePanelProps {
  pageId: number;
  initialState: PageStateConfig | undefined;
  onSave: (state: PageStateConfig | undefined) => Promise<void>;
}

const DEFAULT_STATE: PageStateConfig = {
  variables: [],
  persistence: 'none',
};

export function PageStatePanel({
  pageId,
  initialState,
  onSave,
}: PageStatePanelProps) {
  const [state, setState] = React.useState<PageStateConfig>(
    initialState || DEFAULT_STATE
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Adding state
  const [isAddingVariable, setIsAddingVariable] = React.useState(false);
  const [newVariable, setNewVariable] = React.useState<StateVariable>({
    name: "",
    type: "string",
    defaultValue: "",
    description: "",
  });

  // Track changes
  React.useEffect(() => {
    const changed =
      JSON.stringify(state) !== JSON.stringify(initialState || DEFAULT_STATE);
    setHasChanges(changed);
  }, [state, initialState]);

  // Reset when initial values change
  React.useEffect(() => {
    setState(initialState || DEFAULT_STATE);
  }, [initialState]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      // If state is empty, save as undefined
      const stateToSave = state.variables.length === 0
        ? undefined
        : state;
      await onSave(stateToSave);
      toast.success("Page state saved");
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving page state:", error);
      toast.error("Failed to save page state");
    } finally {
      setIsSaving(false);
    }
  };

  const validateName = (name: string, existingNames: string[]): string | null => {
    if (!name.trim()) return "Name is required";
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return "Name must start with a letter and contain only letters, numbers, and underscores";
    }
    if (existingNames.includes(name)) {
      return "A variable with this name already exists";
    }
    return null;
  };

  const handleAddVariable = () => {
    const allNames = state.variables.map(v => v.name);
    const error = validateName(newVariable.name, allNames);
    if (error) {
      toast.error(error);
      return;
    }

    setState({
      ...state,
      variables: [...state.variables, { ...newVariable, name: newVariable.name.trim() }],
    });
    setNewVariable({ name: "", type: "string", defaultValue: "", description: "" });
    setIsAddingVariable(false);
  };

  const handleRemoveVariable = (name: string) => {
    setState({
      ...state,
      variables: state.variables.filter((v) => v.name !== name),
    });
  };

  const getDefaultValueForType = (type: StateVariableType): unknown => {
    switch (type) {
      case 'string': return '';
      case 'number': return 0;
      case 'boolean': return false;
      case 'object': return {};
      case 'array': return [];
      default: return '';
    }
  };

  const isEmpty = state.variables.length === 0;

  return (
    <div className="w-full space-y-3 px-3 py-2">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Box className="h-3 w-3" />
        Page State
      </div>

      {/* Variables Section */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          State Variables
        </div>

        {state.variables.length > 0 && (
          <div className="space-y-1.5">
            {state.variables.map((variable) => (
              <div
                key={variable.name}
                className="flex items-center gap-2 p-2 border rounded-md bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs font-mono bg-muted px-1 rounded">
                      {variable.name}
                    </code>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {variable.type}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Default: {JSON.stringify(variable.defaultValue)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={() => handleRemoveVariable(variable.name)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add Variable Form */}
        {isAddingVariable && (
          <div className="space-y-2 p-2 border rounded-md bg-muted/20">
            <div className="space-y-1">
              <Label className="text-[10px]">Name</Label>
              <Input
                placeholder="e.g., selectedCategory"
                value={newVariable.name}
                onChange={(e) =>
                  setNewVariable({ ...newVariable, name: e.target.value })
                }
                className="h-7 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Type</Label>
                <Select
                  value={newVariable.type}
                  onValueChange={(val) =>
                    setNewVariable({
                      ...newVariable,
                      type: val as StateVariableType,
                      defaultValue: getDefaultValueForType(val as StateVariableType),
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="object">Object</SelectItem>
                    <SelectItem value="array">Array</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px]">Default</Label>
                {newVariable.type === 'boolean' ? (
                  <div className="flex items-center h-7">
                    <Switch
                      checked={newVariable.defaultValue as boolean}
                      onCheckedChange={(checked) =>
                        setNewVariable({ ...newVariable, defaultValue: checked })
                      }
                    />
                  </div>
                ) : newVariable.type === 'number' ? (
                  <Input
                    type="number"
                    value={newVariable.defaultValue as number}
                    onChange={(e) =>
                      setNewVariable({ ...newVariable, defaultValue: Number(e.target.value) })
                    }
                    className="h-7 text-xs"
                  />
                ) : (
                  <Input
                    placeholder={newVariable.type === 'object' ? '{}' : newVariable.type === 'array' ? '[]' : ''}
                    value={typeof newVariable.defaultValue === 'string' ? newVariable.defaultValue : JSON.stringify(newVariable.defaultValue)}
                    onChange={(e) => {
                      if (newVariable.type === 'object' || newVariable.type === 'array') {
                        try {
                          const parsed = JSON.parse(e.target.value || (newVariable.type === 'object' ? '{}' : '[]'));
                          setNewVariable({ ...newVariable, defaultValue: parsed });
                        } catch {
                          // Keep as string while editing
                          setNewVariable({ ...newVariable, defaultValue: e.target.value });
                        }
                      } else {
                        setNewVariable({ ...newVariable, defaultValue: e.target.value });
                      }
                    }}
                    className="h-7 text-xs"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                className="flex-1 h-6 text-xs"
                onClick={handleAddVariable}
                disabled={!newVariable.name.trim()}
              >
                Add
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  setIsAddingVariable(false);
                  setNewVariable({ name: "", type: "string", defaultValue: "", description: "" });
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!isAddingVariable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-6 text-[10px]"
            onClick={() => setIsAddingVariable(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Variable
          </Button>
        )}
      </div>

      {/* Persistence Section */}
      {!isEmpty && (
        <div className="space-y-1.5 pt-2 border-t">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Persistence
          </div>
          <RadioGroup
            value={state.persistence}
            onValueChange={(val) => setState({ ...state, persistence: val as StatePersistence })}
            className="flex gap-3"
          >
            <div className="flex items-center space-x-1">
              <RadioGroupItem value="none" id="persist-none" className="h-3 w-3" />
              <Label htmlFor="persist-none" className="text-[10px] cursor-pointer">None</Label>
            </div>
            <div className="flex items-center space-x-1">
              <RadioGroupItem value="session" id="persist-session" className="h-3 w-3" />
              <Label htmlFor="persist-session" className="text-[10px] cursor-pointer">Session</Label>
            </div>
            <div className="flex items-center space-x-1">
              <RadioGroupItem value="localStorage" id="persist-local" className="h-3 w-3" />
              <Label htmlFor="persist-local" className="text-[10px] cursor-pointer">Local</Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Empty State */}
      {isEmpty && !isAddingVariable && (
        <div className="py-2 text-center">
          <p className="text-[10px] text-muted-foreground">
            Add variables to manage client state.
            <br />
            Use boolean type for dialogs/toggles.
          </p>
        </div>
      )}

      {/* Save Button */}
      {hasChanges && (
        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
          className="w-full h-7 text-xs"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      )}

      {/* Help Text */}
      <p className="text-[10px] text-muted-foreground pt-1">
        Access state with{" "}
        <code className="bg-muted px-0.5 rounded">{"{{state.name}}"}</code>
        <br />
        State auto-populates from matching URL params.
      </p>
    </div>
  );
}
