'use client';

import React, { useMemo } from 'react';
import { VariableChip, type VariableSource } from './VariableChip';
import { cn } from '@/lib/utils';

export interface KnownVariable {
  name: string;
  source: 'input' | 'context';
}

interface TemplateRendererProps {
  template: string;
  knownVariables?: KnownVariable[];
  className?: string;
}

interface TemplatePart {
  type: 'text' | 'variable';
  value: string;
}

/**
 * Renders a Jinja2 template with {{ variables }} replaced by colored chips.
 *
 * - Parses the template to find all {{ variable }} patterns
 * - Renders variables as VariableChip components
 * - Interspersed text is rendered as-is
 */
export function TemplateRenderer({ template, knownVariables = [], className }: TemplateRendererProps) {
  // Parse template into parts
  const parts = useMemo((): TemplatePart[] => {
    if (!template) return [];

    const result: TemplatePart[] = [];
    // Match {{ variable }} with optional whitespace
    const regex = /\{\{\s*([^}]+?)\s*\}\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(template)) !== null) {
      // Add text before this match
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          value: template.slice(lastIndex, match.index),
        });
      }

      // Add the variable
      result.push({
        type: 'variable',
        value: match[1].trim(),
      });

      lastIndex = regex.lastIndex;
    }

    // Add remaining text after last match
    if (lastIndex < template.length) {
      result.push({
        type: 'text',
        value: template.slice(lastIndex),
      });
    }

    return result;
  }, [template]);

  // Build lookup map for known variables
  const variableSourceMap = useMemo(() => {
    const map = new Map<string, VariableSource>();
    for (const v of knownVariables) {
      map.set(v.name, v.source);
    }
    return map;
  }, [knownVariables]);

  // Determine variant for a variable name
  const getVariableVariant = (name: string): VariableSource => {
    return variableSourceMap.get(name) || 'default';
  };

  if (!template) {
    return <span className="text-muted-foreground italic">No template</span>;
  }

  return (
    <div className={cn('text-sm leading-relaxed whitespace-pre-wrap', className)}>
      {parts.map((part, index) => {
        if (part.type === 'variable') {
          return (
            <VariableChip
              key={`var-${index}`}
              name={part.value}
              variant={getVariableVariant(part.value)}
            />
          );
        }
        return <span key={`text-${index}`}>{part.value}</span>;
      })}
    </div>
  );
}
