'use client';

import React, { useEffect } from 'react';
import { useStore } from '@tanstack/react-store';
import type { AppDTO } from '@/app/mappers/puck-app-mapper';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { appsStore, appsSelectors, appsActions } from '@/stores/apps.store';
import { AppCard } from './AppCard';
import { AppDetailsView } from './AppDetailsView';
import { AppFormDialog } from './AppFormDialog';

// AIDEV-NOTE: Apps dashboard using TanStack Store for state management
// Simpler than agents dashboard - no team filters, no worker status

interface AppsDashboardClientProps {
  initialApps: AppDTO[];
}

export default function AppsDashboardClient({ initialApps }: AppsDashboardClientProps) {
  // Use TanStack Store with fine-grained subscriptions
  const apps = useStore(appsStore, appsSelectors.apps);
  const selectedApp = useStore(appsStore, appsSelectors.selectedApp);
  const searchQuery = useStore(appsStore, appsSelectors.searchQuery);
  const loading = useStore(appsStore, appsSelectors.loading);
  const error = useStore(appsStore, appsSelectors.error);
  const isPanelCollapsed = useStore(appsStore, appsSelectors.isPanelCollapsed);
  const isCreateMode = useStore(appsStore, appsSelectors.isCreateMode);
  const formDialogOpen = useStore(appsStore, appsSelectors.formDialogOpen);

  // Initialize store with initial data
  useEffect(() => {
    appsActions.setApps(initialApps);
  }, [initialApps]);

  const handleCreateApp = () => {
    appsActions.setCreateMode(true);
  };

  const handleCancelCreate = () => {
    appsActions.setCreateMode(false);
  };

  // Use store selector for filtered apps
  const filteredApps = useStore(appsStore, appsSelectors.filteredApps);

  return (
    <>
      <div className="flex h-full">
        {/* Left Pane: App List */}
        <div
          className={`transition-all duration-300 ${
            isPanelCollapsed ? 'w-12' : 'w-1/4'
          } border-r flex flex-col`}
        >
          <div className="flex items-center p-2">
            {!isPanelCollapsed && <h2 className="text-lg font-semibold">Apps</h2>}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => appsActions.togglePanelCollapsed()}
              className="ml-auto"
            >
              {isPanelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
          {!isPanelCollapsed && (
            <div className="p-2 flex flex-col gap-4 flex-grow">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Search apps..."
                  value={searchQuery}
                  onChange={(e) => appsActions.setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Create Button */}
              <Button onClick={handleCreateApp}>
                <Plus size={16} className="mr-2" />
                New App
              </Button>

              {/* App List */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">
                    {error}
                  </div>
                )}
                {loading ? (
                  <Loading text="Loading apps..." />
                ) : filteredApps.length === 0 ? (
                  <div className="text-center p-8">
                    <h3 className="text-xl font-semibold text-foreground mb-2">No apps found</h3>
                    <p className="text-md text-muted-foreground mb-4">
                      {searchQuery ? 'No apps match your search' : 'Create your first app to get started'}
                    </p>
                    {!searchQuery && (
                      <Button onClick={handleCreateApp}>
                        <Plus size={16} className="mr-2" />
                        Create App
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredApps.map((app) => (
                    <AppCard
                      key={app.id}
                      app={app}
                      isSelected={selectedApp?.id === app.id}
                      onClick={() => {
                        appsActions.setSelectedApp(app);
                        appsActions.setCreateMode(false);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: App Details or Selection Prompt */}
        <div className="flex-1 p-0">
          <Card className="h-full rounded-none border-none">
            <CardContent className="p-6 h-full overflow-y-auto">
              {selectedApp ? (
                <AppDetailsView
                  app={selectedApp}
                  onBack={() => appsActions.setSelectedApp(null)}
                />
              ) : (
                <div className="text-center p-8 h-full flex flex-col items-center justify-center">
                  <h3 className="text-2xl font-bold text-foreground mb-2">Select an app</h3>
                  <p className="text-lg text-muted-foreground mb-4">
                    Choose an app from the list to view details and manage pages
                  </p>
                  <Button onClick={handleCreateApp} className="mt-2">
                    <Plus size={16} className="mr-2" />
                    Create New App
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Form Dialog for Create/Edit */}
      {formDialogOpen && (
        <AppFormDialog
          isOpen={formDialogOpen}
          onClose={() => appsActions.setFormDialogOpen(false)}
          app={isCreateMode ? undefined : selectedApp || undefined}
        />
      )}
    </>
  );
}
