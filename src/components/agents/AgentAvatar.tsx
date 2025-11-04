import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { generateAvatarDataUri, getAvatarColor, migrateAvatarConfig, type AvatarConfig } from '@/lib/avatars';

interface AgentAvatarProps {
  avatarConfig?: AvatarConfig | null;
  agentId?: number | string;  // Used as seed for deterministic avatar generation
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CONFIG = {
  sm: {
    container: 'w-8 h-8',
    img: 'w-full h-full',
  },
  md: {
    container: 'w-10 h-10',
    img: 'w-full h-full',
  },
  lg: {
    container: 'w-12 h-12',
    img: 'w-full h-full',
  },
};

/**
 * AgentAvatar - Displays agent avatar using DiceBear character illustrations
 *
 * Uses the avatar config from the agent to display a customizable
 * character illustration with a colored background. Falls back to default Lorelei style.
 */
export function AgentAvatar({ avatarConfig, agentId, size = 'md', className }: AgentAvatarProps) {
  const config = migrateAvatarConfig(avatarConfig);
  const colors = getAvatarColor(config.color);
  const sizes = SIZE_CONFIG[size];

  // Generate avatar data URI with useMemo for performance
  // Use stored seed if available, otherwise fallback to agentId for backward compatibility
  const avatarDataUri = useMemo(() => {
    const seed = config.seed || agentId?.toString() || 'default';
    return generateAvatarDataUri(
      config.style,
      seed,
      config.color,
      config.options
    );
  }, [config.style, config.color, config.seed, config.options, agentId]);

  return (
    <div
      className={cn(
        'rounded-lg flex items-center justify-center overflow-hidden',
        sizes.container,
        colors.bg,
        className
      )}
    >
      <img
        src={avatarDataUri}
        alt="Agent avatar"
        className={cn(sizes.img, 'object-cover')}
      />
    </div>
  );
}
