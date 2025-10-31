'use client';

import React, { ReactNode } from 'react';
import { CanvasBase } from '@/components/canvas/CanvasBase';

/**
 * CenteredCanvasLayout - Wraps CanvasBase with centered content container
 *
 * Provides consistent centered layout with max-width constraint for detail pages.
 * Used for: Teams, Agents, Skills (NOT Apps - they need full-width for Puck editor)
 *
 * Structure:
 * - CanvasBase (collapse button + flex layout)
 *   - container mx-auto p-6 (responsive container with padding)
 *     - max-w-6xl mx-auto (centered with max width constraint)
 *
 * AIDEV-NOTE: This matches the skills page pattern (container → max-w-6xl)
 * and provides DRY component for Teams and Agents pages.
 */

interface CenteredCanvasLayoutProps {
  children: ReactNode;
  maxWidth?: '4xl' | '5xl' | '6xl' | '7xl';
  padding?: '4' | '6' | '8';
  className?: string;
}

export function CenteredCanvasLayout({
  children,
  maxWidth = '6xl',
  padding = '6',
  className = ''
}: CenteredCanvasLayoutProps) {
  const maxWidthClass = `max-w-${maxWidth}`;
  const paddingClass = `p-${padding}`;

  return (
    <CanvasBase>
      <div className={`container mx-auto ${paddingClass} h-full overflow-y-auto`}>
        <div className={`${maxWidthClass} mx-auto ${className}`}>
          {children}
        </div>
      </div>
    </CanvasBase>
  );
}
