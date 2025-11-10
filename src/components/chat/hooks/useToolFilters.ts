import { useState, useEffect } from 'react';
import { ReferenceCategory } from '@/ddd/domain/chat/value-objects/reference-types';

/**
 * Hook to manage tool filter state
 * Handles categories, apps, connection filters, and auto-toggle logic
 */
export function useToolFilters() {
  const [selectedCategories, setSelectedCategories] = useState<ReferenceCategory[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [requiresConnection, setRequiresConnection] = useState<boolean | undefined>(undefined);
  const [showReferenceTools, setShowReferenceTools] = useState(true);

  // Auto-hide reference tools when using app or connected-only filters
  useEffect(() => {
    if (selectedApps.length > 0 || connectedOnly) {
      setShowReferenceTools(false);
    } else if (selectedApps.length === 0 && !connectedOnly && selectedCategories.length === 0) {
      setShowReferenceTools(true);
    }
  }, [selectedApps, connectedOnly, selectedCategories]);

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
    setConnectedOnly(false);
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
