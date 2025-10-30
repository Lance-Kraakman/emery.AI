'use client';

import React, { useEffect, useState } from 'react';
import type { AppDTO } from '@/app/mappers/puck-app-mapper';
import type { PageDTO } from '@/app/mappers/puck-page-mapper';
import type { ViewDTO } from '@/app/mappers/view-mapper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Trash2 } from 'lucide-react';
import { appsActions } from '@/stores/apps.store';
import { deleteApp } from '@/app/actions/puck-apps';
import { getPages } from '@/app/actions/puck-pages';
import { getViewsForOrganization } from '@/app/actions/views';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PagesSection } from './PagesSection';
import { DataSourcesSection } from './DataSourcesSection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AppDetailsViewProps {
  app: AppDTO;
}

export function AppDetailsView({ app }: AppDetailsViewProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pages, setPages] = useState<PageDTO[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [dataSources, setDataSources] = useState<ViewDTO[]>([]);
  const [loadingDataSources, setLoadingDataSources] = useState(true);

  // Load pages for this app
  const loadPages = async () => {
    try {
      setLoadingPages(true);
      const pagesData = await getPages(app.id);
      setPages(pagesData);
      appsActions.setPages(pagesData);
    } catch (error) {
      console.error('Error loading pages:', error);
      toast.error("Failed to load pages for this app");
    } finally {
      setLoadingPages(false);
    }
  };

  // Load data sources for the organization
  const loadDataSources = async () => {
    try {
      setLoadingDataSources(true);
      const dataSourcesData = await getViewsForOrganization();
      setDataSources(dataSourcesData);
    } catch (error) {
      console.error('Error loading data sources:', error);
      toast.error("Failed to load data sources");
    } finally {
      setLoadingDataSources(false);
    }
  };

  useEffect(() => {
    loadPages();
    loadDataSources();
  }, [app.id]);

  const handleEdit = () => {
    appsActions.setEditMode(true, app.id);
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const result = await deleteApp(app.id);

      if (!result.success) {
        toast.error(result.error || "Failed to delete app");
        return;
      }

      toast.success("App deleted successfully");

      appsActions.removeApp(app.id);
      appsActions.setSelectedApp(null);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting app:', error);
      toast.error("Failed to delete app");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{app.name}</h2>
          <p className="text-sm text-muted-foreground">/{app.slug}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* App Info */}
      <Card>
        <CardHeader>
          <CardTitle>App Information</CardTitle>
          <CardDescription>Basic details about this app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {app.description && (
            <div>
              <label className="text-sm font-medium">Description</label>
              <p className="text-sm text-muted-foreground mt-1">{app.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Created</label>
              <p className="text-sm text-muted-foreground mt-1">
                {app.createdAt ? format(new Date(app.createdAt), 'PPp') : 'Unknown'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Last Updated</label>
              <p className="text-sm text-muted-foreground mt-1">
                {app.updatedAt ? format(new Date(app.updatedAt), 'PPp') : 'Unknown'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pages Section */}
      <PagesSection appId={app.id} pages={pages} loading={loadingPages} onPagesChange={loadPages} />

      {/* Data Sources Section */}
      <DataSourcesSection
        dataSources={dataSources}
        loading={loadingDataSources}
        onDataSourcesChange={loadDataSources}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the app "{app.name}" and all its pages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
