'use client';

/**
 * LinkBlock - Client Component
 *
 * AIDEV-NOTE: Renders a link with different style variants.
 * Supports action execution before navigation (onClick handlers).
 */

import { Button } from '@/components/ui/button';
import { Section } from '@/components/puck/components/Section';
import { cn } from '@/lib/utils';
import type { Action } from '@/components/puck/types/actions';
import { useActionContext } from '@/components/puck/contexts/ActionContext';
import { executeActions } from '@/components/puck/actions/execute-action';
import styles from './styles.module.css';

export interface LinkBlockProps {
  label: string;
  href: string;
  openInNewTab: boolean;
  style: 'inline' | 'button' | 'nav';
  variant: 'default' | 'secondary' | 'outline' | 'ghost' | 'link';
  size: 'sm' | 'default' | 'lg';
  underline: boolean;
  actions?: Action[];
}

export default function LinkBlock({
  label,
  href,
  openInNewTab,
  style,
  variant,
  size,
  underline,
  actions = [],
}: LinkBlockProps) {
  const buildActionContext = useActionContext();

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If there are actions, execute them first
    if (actions && actions.length > 0) {
      e.preventDefault(); // Prevent immediate navigation

      try {
        const context = buildActionContext();
        await executeActions(actions, context);

        // After actions complete, navigate manually if needed
        if (href && href !== '#') {
          if (openInNewTab) {
            window.open(href, '_blank', 'noopener,noreferrer');
          } else {
            window.location.href = href;
          }
        }
      } catch (error) {
        console.error('[LinkBlock] Error executing actions:', error);
        // Don't navigate on error
      }
    }
    // If no actions, let the browser handle normal link navigation
  };

  // Inline style
  if (style === 'inline') {
    return (
      <Section>
        <a
          href={href}
          onClick={handleClick}
          target={openInNewTab ? '_blank' : undefined}
          rel={openInNewTab ? 'noopener noreferrer' : undefined}
          className={cn(
            styles.inlineLink,
            underline && styles.underline
          )}
        >
          {label}
        </a>
      </Section>
    );
  }

  // Nav style
  if (style === 'nav') {
    return (
      <Section>
        <a
          href={href}
          onClick={handleClick}
          target={openInNewTab ? '_blank' : undefined}
          rel={openInNewTab ? 'noopener noreferrer' : undefined}
          className={styles.navLink}
        >
          {label}
        </a>
      </Section>
    );
  }

  // Button style
  return (
    <Section>
      <Button
        variant={variant}
        size={size}
        asChild
      >
        <a
          href={href}
          onClick={handleClick}
          target={openInNewTab ? '_blank' : undefined}
          rel={openInNewTab ? 'noopener noreferrer' : undefined}
        >
          {label}
        </a>
      </Button>
    </Section>
  );
}
