import { useState } from 'react';
import { ReferenceCategory } from '@/ddd/domain/chat/value-objects/reference-types';

/**
 * Hook to manage tool filter state
 * Handles categories, apps, and connection filters independently
 */
export function useToolFilters() {
  const [selectedCategories, setSelectedCategories] = useState<ReferenceCategory[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [connectedOnly, setConnectedOnly] = useState(true);
  const [requiresConnection, setRequiresConnection] = useState<boolean | undefined>(undefined);
  const [showReferenceTools, setShowReferenceTools] = useState(true);

  const toggleCategory = (category: ReferenceCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedApps.length > 0 ||
    connectedOnly ||
    requiresConnection !== undefined;

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedApps([]);
    setConnectedOnly(true);
    setRequiresConnection(undefined);
    setShowReferenceTools(true);
  };

  return {
    // State
    selectedCategories,
    selectedApps,
    connectedOnly,
    requiresConnection,
    showReferenceTools,
    hasActiveFilters,

    // Setters
    setSelectedCategories,
    setSelectedApps,
    setConnectedOnly,
    setRequiresConnection,
    setShowReferenceTools,

    // Actions
    toggleCategory,
    clearAllFilters,
  };
}
