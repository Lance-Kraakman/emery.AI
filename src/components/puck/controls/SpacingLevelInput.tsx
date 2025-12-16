/**
 * SpacingLevelInput - Compact dropdown for selecting spacing levels 0-10
 *
 * Used in the SpacingRadiusControl for individual side/corner inputs.
 */

"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type SpacingLevel, SPACING_LEVEL_LABELS } from "../utils/spacing";

export interface SpacingLevelInputProps {
  value: SpacingLevel;
  onChange: (value: SpacingLevel) => void;
  disabled?: boolean;
  className?: string;
  /** Compact mode shows only the number */
  compact?: boolean;
}

const SPACING_LEVELS: SpacingLevel[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function SpacingLevelInput({
  value,
  onChange,
  disabled = false,
  className,
  compact = false,
}: SpacingLevelInputProps) {
  return (
    <Select
      value={String(value)}
      onValueChange={(v) => onChange(Number(v) as SpacingLevel)}
      disabled={disabled}
    >
      <SelectTrigger
        className={`h-7 text-xs ${compact ? "w-14 px-1.5" : "w-20 px-2"} ${className || ""}`}
      >
        <SelectValue>
          {compact ? String(value) : SPACING_LEVEL_LABELS[value]}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SPACING_LEVELS.map((level) => (
          <SelectItem key={level} value={String(level)} className="text-xs">
            <span className="flex items-center gap-2">
              <span className="w-4 text-right font-mono">{level}</span>
              <span className="text-muted-foreground">
                {SPACING_LEVEL_LABELS[level]}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
