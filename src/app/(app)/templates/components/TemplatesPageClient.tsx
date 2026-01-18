'use client';

/**
 * TemplatesPageClient Component
 *
 * Client component wrapper for the templates page.
 * Handles state management, refresh, and import dialog.
 */

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TemplateGallery } from './TemplateGallery';
import { ImportTemplateDialog } from '@/components/templates/ImportTemplateDialog';
import type { TemplateDTO, BuiltinTemplateInfo } from '@/ddd/domain/templates/types';

interface TemplatesPageClientProps {
  initialBuiltinTemplates: BuiltinTemplateInfo[];
  initialSavedTemplates: TemplateDTO[];
}

export function TemplatesPageClient({
  initialBuiltinTemplates,
  initialSavedTemplates,
}: TemplatesPageClientProps) {
  const router = useRouter();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    // Small delay to show loading state
    setTimeout(() => setIsRefreshing(false), 500);
  }, [router]);

  const handleImportComplete = useCallback(() => {
    setIsImportDialogOpen(false);
    handleRefresh();
  }, [handleRefresh]);

  return (
    <>
      <TemplateGallery
        builtinTemplates={initialBuiltinTemplates}
        savedTemplates={initialSavedTemplates}
        onImportClick={() => setIsImportDialogOpen(true)}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <ImportTemplateDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImportComplete={handleImportComplete}
      />
    </>
  );
}

export default TemplatesPageClient;
