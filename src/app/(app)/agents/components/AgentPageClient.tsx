'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalProvider } from './modals/ModalContext';
import { ModalManager } from './modals/ModalManager';

// AIDEV-NOTE: Client wrapper for agent page that provides:
// 1. ModalProvider context for modals
// 2. Back navigation handling
// 3. Refresh callback for updates
// Children are server components that stream in via Suspense

interface AgentPageClientProps {
  children: React.ReactNode;
}

export function AgentPageClient({ children }: AgentPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const handleBack = () => {
    if (returnTo?.startsWith('org-chart')) {
      const selectedMatch = returnTo.match(/selected=([^&]+)/);
      const selected = selectedMatch ? selectedMatch[1] : null;
      router.push(selected ? `/organization?selected=${selected}` : '/organization');
    } else {
      router.back();
    }
  };

  const handleUpdate = () => {
    router.refresh();
  };

  return (
    <ModalProvider>
      <div className="h-full flex flex-col bg-card relative">
        {/* Back button when navigated from org chart */}
        {returnTo?.startsWith('org-chart') && (
          <div className="absolute top-2 left-2 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="bg-background/50 backdrop-blur-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Org Chart
            </Button>
          </div>
        )}

        {/* Streamed content from server components */}
        {children}
      </div>

      {/* Modal manager */}
      <ModalManager onUpdate={handleUpdate} />
    </ModalProvider>
  );
}
