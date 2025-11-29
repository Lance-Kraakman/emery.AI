'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CellWithTooltipProps<T = string | number | Date | null | undefined> {
  /** The raw value to display */
  value: T;
  /** Optional formatter function for display */
  formatValue?: (val: T) => string;
  /** Optional custom content to render instead of formatted value */
  children?: React.ReactNode;
  /** Additional className for the container */
  className?: string;
}

/**
 * CellWithTooltip - Generic wrapper that detects overflow and shows tooltip
 *
 * Used by custom cell components (TextCell, NumberCell, DateCell) to provide
 * consistent overflow handling and tooltips across the data grid.
 *
 * Features:
 * - Detects text overflow using scrollWidth vs clientWidth
 * - Shows styled tooltip only when content is truncated
 * - Supports custom formatters for different data types
 * - Supports custom children for complex content
 */
export function CellWithTooltip<T>({
  value,
  formatValue,
  children,
  className = ''
}: CellWithTooltipProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Format the display value
  const displayValue = formatValue
    ? formatValue(value)
    : value === null || value === undefined
      ? ''
      : String(value);

  // Check for overflow on mount and when value changes
  const checkOverflow = useCallback(() => {
    if (ref.current) {
      const isOverflow = ref.current.scrollWidth > ref.current.clientWidth;
      setIsOverflowing(isOverflow);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    // Also check on resize
    const observer = new ResizeObserver(checkOverflow);
    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, [displayValue, checkOverflow]);

  const content = (
    <div
      ref={ref}
      className={`truncate w-full ${className}`}
    >
      {children ?? displayValue}
    </div>
  );

  // Only wrap in tooltip if content is actually overflowing
  if (!isOverflowing) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {content}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-md break-words z-[9999]"
      >
        {displayValue}
      </TooltipContent>
    </Tooltip>
  );
}

export default CellWithTooltip;
