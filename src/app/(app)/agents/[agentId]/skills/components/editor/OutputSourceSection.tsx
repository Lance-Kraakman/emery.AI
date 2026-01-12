'use client';

/**
 * OutputSourceSection
 *
 * Configures where each skill output gets its value from.
 * Maps skill-level outputs to node-level outputs (e.g., {{agentic_node.summary}}).
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';
import type { OutputDefinition } from '@/ddd/domain/skills/entities/skill';

interface AvailableNodeOutput {
  nodeId: string;
  nodeName: string;
  outputName: string;
  outputType?: string;
}

interface OutputSourceSectionProps {
  outputs: OutputDefinition[];
  onOutputsChange: (outputs: OutputDefinition[]) => void;
  availableNodeOutputs: AvailableNodeOutput[];
  isReadOnly?: boolean;
}

/**
 * Format a node output as a variable reference string
 */
function formatSourceValue(nodeId: string, outputName: string): string {
  return `${nodeId}:${outputName}`;
}

/**
 * Parse a source value back to nodeId and outputName
 */
function parseSourceValue(value: string): { nodeId: string; outputName: string } | null {
  const [nodeId, outputName] = value.split(':');
  if (!nodeId || !outputName) return null;
  return { nodeId, outputName };
}

export function OutputSourceSection({
  outputs,
  onOutputsChange,
  availableNodeOutputs,
  isReadOnly = false,
}: OutputSourceSectionProps) {
  const handleSourceChange = (outputIndex: number, value: string) => {
    const newOutputs = [...outputs];

    if (value === '__none__') {
      // Clear the source
      newOutputs[outputIndex] = {
        ...newOutputs[outputIndex],
        source: undefined,
      };
    } else {
      const parsed = parseSourceValue(value);
      if (parsed) {
        newOutputs[outputIndex] = {
          ...newOutputs[outputIndex],
          source: {
            type: 'node_output',
            nodeId: parsed.nodeId,
            outputName: parsed.outputName,
          },
        };
      }
    }

    onOutputsChange(newOutputs);
  };

  // Get current source value for an output
  const getSourceValue = (output: OutputDefinition): string => {
    if (!output.source) return '__none__';
    return formatSourceValue(output.source.nodeId, output.source.outputName);
  };

  // Get display name for a node output
  const getNodeOutputDisplay = (nodeOutput: AvailableNodeOutput): string => {
    return `${nodeOutput.nodeName}.${nodeOutput.outputName}`;
  };

  if (outputs.length === 0) return null;

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Output Sources</Label>
        <span className="text-[10px] text-muted-foreground">
          Map skill outputs to node outputs
        </span>
      </div>

      <div className="space-y-2">
        {outputs.map((output, index) => (
          <div
            key={output.name}
            className="flex items-center gap-2 text-sm"
          >
            {/* Skill output name */}
            <div className="flex items-center gap-1.5 min-w-[100px]">
              <span className="font-mono text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                {output.name}
              </span>
            </div>

            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />

            {/* Source selector */}
            <Select
              value={getSourceValue(output)}
              onValueChange={(value) => handleSourceChange(index, value)}
              disabled={isReadOnly}
            >
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Select source..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">No source (manual)</span>
                </SelectItem>
                {availableNodeOutputs.map((nodeOutput) => (
                  <SelectItem
                    key={formatSourceValue(nodeOutput.nodeId, nodeOutput.outputName)}
                    value={formatSourceValue(nodeOutput.nodeId, nodeOutput.outputName)}
                  >
                    <span className="font-mono text-xs">
                      {getNodeOutputDisplay(nodeOutput)}
                    </span>
                    {nodeOutput.outputType && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">
                        ({nodeOutput.outputType})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Each skill output can be mapped to a node&apos;s extracted output value.
      </p>
    </div>
  );
}
