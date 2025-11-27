'use client'

import React from 'react';

interface ToolIconProps {
  /** Icon value - can be emoji, local path, or CDN URL */
  icon: string;
  /** App icon URL as fallback */
  appIconUrl?: string;
  /** Alt text for accessibility */
  alt: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
}

/**
 * ToolIcon Component
 *
 * Displays tool or app icons with support for:
 * - Emojis (detected via Unicode)
 * - Local paths (/icons/slack.svg)
 * - CDN URLs (https://assets.pipedream.net/...)
 * - Fallback to app icon if tool icon fails
 * - Final fallback to first letter placeholder
 */
export function ToolIcon({
  icon,
  appIconUrl,
  alt,
  size = 'md',
  className = ''
}: ToolIconProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-base',
    md: 'w-10 h-10 text-2xl',
    lg: 'w-16 h-16 text-4xl'
  };

  // Check if icon is emoji (Unicode character)
  const isEmoji = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(icon);

  if (isEmoji) {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center ${className}`}
        role="img"
        aria-label={alt}
      >
        {icon}
      </div>
    );
  }

  // Otherwise treat as URL (works for both local paths and CDN URLs)
  return (
    <img
      className={`${sizeClasses[size]} rounded-lg ring-1 ring-border object-cover ${className}`}
      src={icon}
      alt={alt}
      crossOrigin="anonymous" // For CDN images
      onError={(e) => {
        // Fallback to app icon if tool icon fails
        const target = e.target as HTMLImageElement;
        if (appIconUrl && target.src !== appIconUrl) {
          target.src = appIconUrl;
        } else {
          // Final fallback: hide image and show letter placeholder
          target.style.display = 'none';
          const placeholder = document.createElement('div');
          placeholder.className = `${sizeClasses[size]} flex items-center justify-center bg-gray-100 rounded-lg font-semibold text-gray-600`;
          placeholder.textContent = alt.charAt(0).toUpperCase();
          placeholder.setAttribute('aria-label', alt);
          target.parentElement?.appendChild(placeholder);
        }
      }}
    />
  );
}
