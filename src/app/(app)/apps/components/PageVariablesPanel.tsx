/**
 * PageVariablesPanel - Configure page-level variables (URL parameters)
 *
 * AIDEV-NOTE: Allows defining expected query parameters for a page.
 * These variables appear in the autocomplete when configuring DataBlock
 * filters or navigation actions.
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
import { Plus, X, Variable } from "lucide-react";
import { toast } from "sonner";
import type { PageVariable } from "@/components/puck/types";

export interface PageVariablesPanelProps {
  pageId: number;
  initialVariables: PageVariable[];
  onSave: (variables: PageVariable[]) => Promise<void>;
}

export function PageVariablesPanel({
  pageId,
  initialVariables,
  onSave,
}: PageVariablesPanelProps) {
  const [variables, setVariables] = React.useState<PageVariable[]>(
    initialVariables || []
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);
  const [newVariable, setNewVariable] = React.useState<PageVariable>({
    name: "",
    type: "string",
    required: false,
    description: "",
  });

  // Track changes
  React.useEffect(() => {
    const changed =
      JSON.stringify(variables) !== JSON.stringify(initialVariables || []);
    setHasChanges(changed);
  }, [variables, initialVariables]);

  // Reset when initial values change
  React.useEffect(() => {
    setVariables(initialVariables || []);
  }, [initialVariables]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(variables);
      toast.success("Page variables saved");
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving page variables:", error);
      toast.error("Failed to save page variables");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddVariable = () => {
    if (!newVariable.name.trim()) return;

    // Validate name format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newVariable.name)) {
      toast.error("Variable name must start with a letter and contain only letters, numbers, and underscores");
      return;
    }

    // Check for duplicates
    if (variables.some((v) => v.name === newVariable.name)) {
      toast.error("A variable with this name already exists");
      return;
    }

    setVariables([...variables, { ...newVariable, name: newVariable.name.trim() }]);
    setNewVariable({ name: "", type: "string", required: false, description: "" });
    setIsAdding(false);
  };

  const handleRemoveVariable = (name: string) => {
    setVariables(variables.filter((v) => v.name !== name));
  };

  return (
    <div className="w-full space-y-1.5 px-3 py-2">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
        <Variable className="h-3 w-3" />
        Page Variables
      </div>

      {/* Existing Variables */}
      {variables.length > 0 && (
        <div className="space-y-1.5">
          {variables.map((variable) => (
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
                  {variable.required && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      required
                    </Badge>
                  )}
                </div>
                {variable.description && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {variable.description}
                  </p>
                )}
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

      {/* Empty State */}
      {variables.length === 0 && !isAdding && (
        <div className="py-3 text-center">
          <p className="text-xs text-muted-foreground">No variables defined</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Add variables to use in filters and navigation
          </p>
        </div>
      )}

      {/* Add Variable Form */}
      {isAdding && (
        <div className="space-y-2 p-2 border rounded-md bg-muted/20">
          <div className="space-y-1">
            <Label className="text-[10px]">Name</Label>
            <Input
              placeholder="e.g., user_id"
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
                    type: val as "string" | "number",
                  })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px]">Required</Label>
              <div className="flex items-center h-7">
                <Switch
                  checked={newVariable.required}
                  onCheckedChange={(checked) =>
                    setNewVariable({ ...newVariable, required: checked })
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">Description (optional)</Label>
            <Input
              placeholder="What is this for?"
              value={newVariable.description || ""}
              onChange={(e) =>
                setNewVariable({ ...newVariable, description: e.target.value })
              }
              className="h-7 text-xs"
            />
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
                setIsAdding(false);
                setNewVariable({
                  name: "",
                  type: "string",
                  required: false,
                  description: "",
                });
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add Button */}
      {!isAdding && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Variable
        </Button>
      )}

      {/* Save Button */}
      {hasChanges && (
        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
          className="w-full h-7 text-xs mt-2"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      )}

      {/* Help Text */}
      <p className="text-[10px] text-muted-foreground pt-1">
        Use variables in DataBlock filters or navigation with{" "}
        <code className="bg-muted px-0.5 rounded">{"{params.name}"}</code> syntax
      </p>
    </div>
  );
}
