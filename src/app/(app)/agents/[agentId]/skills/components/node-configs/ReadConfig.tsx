'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ConfigWithSkillInputs, ReadNodeData } from './types';

/**
 * Read node config - database read configuration
 */
export function ReadConfig({
  data,
  onUpdate,
  disabled,
}: ConfigWithSkillInputs<ReadNodeData>) {
  const readConfig = data.readConfig || {
    mode: 'single_row' as const,
    sourceTableId: 0,
    fieldMappings: [],
  };

  const updateReadConfig = (updates: Partial<typeof readConfig>) => {
    onUpdate({ readConfig: { ...readConfig, ...updates } });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Read Mode</Label>
        <Select
          value={readConfig.mode}
          onValueChange={(value: 'single_row' | 'query') =>
            updateReadConfig({ mode: value })
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single_row">Single Row</SelectItem>
            <SelectItem value="query">Query (Multiple Rows)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Source Table ID</Label>
        <Input
          type="number"
          value={readConfig.sourceTableId || 0}
          onChange={(e) =>
            updateReadConfig({ sourceTableId: parseInt(e.target.value) || 0 })
          }
          placeholder="Table ID"
          disabled={disabled}
          className="h-8 text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Enter the Baserow table ID to read from
        </p>
      </div>

      {readConfig.mode === 'query' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Max Results</Label>
          <Input
            type="number"
            value={readConfig.queryLimit || 100}
            onChange={(e) =>
              updateReadConfig({ queryLimit: parseInt(e.target.value) || 100 })
            }
            placeholder="100"
            disabled={disabled}
            className="h-8 text-sm"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">
          Field Mappings ({readConfig.fieldMappings?.length || 0})
        </Label>
        <p className="text-[10px] text-muted-foreground">
          Configure which table fields map to output variables in the Output
          section below
        </p>
      </div>
    </div>
  );
}
