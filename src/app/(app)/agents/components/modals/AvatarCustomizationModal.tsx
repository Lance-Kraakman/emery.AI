'use client';

import React, { useState } from 'react';
import { BaseModal } from './BaseModal';
import { AvatarPicker } from '@/components/agents/AvatarPicker';
import type { AvatarConfigV1 } from '@/lib/avatars';

interface AvatarCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: AvatarConfigV1 | null;
  onSave: (config: AvatarConfigV1) => void;
}

/**
 * AvatarCustomizationModal - Dedicated modal for customizing agent avatar
 *
 * Provides a focused interface for selecting character style and color
 * without cluttering the main agent profile form.
 */
export function AvatarCustomizationModal({
  isOpen,
  onClose,
  initialConfig,
  onSave,
}: AvatarCustomizationModalProps) {
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfigV1 | null>(
    initialConfig || null
  );

  const handleSave = () => {
    if (avatarConfig) {
      onSave(avatarConfig);
    }
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Customize Avatar"
      size="md"
      closeOnEscape={true}
      closeOnOutsideClick={true}
    >
      <div className="p-6">
        <AvatarPicker
          value={avatarConfig}
          onChange={setAvatarConfig}
        />
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/50">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Save Avatar
        </button>
      </div>
    </BaseModal>
  );
}
