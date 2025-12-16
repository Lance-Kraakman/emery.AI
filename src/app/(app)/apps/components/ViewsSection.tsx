'use client';

import React, { useState } from 'react';
import type { ViewDTO } from '@/app/mappers/view-mapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Database, Edit, Trash2, MoreVertical, Filter, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { ViewFormDialog } from './ViewFormDialog';
import { deleteView } from '@/app/actions/views';
import Link from 'next/link';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';

interface ViewsSectionProps {
  views: ViewDTO[];
  loading: boolean;
  onViewsChange?: () => void;
}

export function ViewsSection({ views, loading, onViewsChange }: ViewsSectionProps) {
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [editingView, setEditingView] = useState<ViewDTO | undefined>();
  const [deletingView, setDeletingView] = useState<ViewDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddView = () => {
    setEditingView(undefined);
    setShowViewDialog(true);
  };

  const handleEditView = (view: ViewDTO) => {
    setEditingView(view);
    setShowViewDialog(true);
  };

  const handleDeleteView = async () => {
    if (!deletingView) return;

    try {
      setIsDeleting(true);
      const result = await deleteView(deletingView.id);

      if (!result.success) {
        toast.error(result.error || "Failed to delete view");
        return;
      }

      toast.success("View deleted successfully");
      setDeletingView(null);

      if (onViewsChange) {
        onViewsChange();
      }
    } catch (error) {
      console.error('Error deleting view:', error);
      toast.error("Failed to delete view");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Views</CardTitle>
              <CardDescription>
                Manage filtered and sorted views of your tables
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleAddView}>
              <Plus className="h-4 w-4 mr-2" />
              Add View
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading text="Loading views..." />
          ) : views.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-medium mb-1">No views yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create custom views of your tables with filters and sorting for use in TableBlock components
              </p>
              <Button size="sm" onClick={handleAddView}>
                <Plus className="h-4 w-4 mr-2" />
                Create First View
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {views.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center justify-between p-2 border rounded hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Database className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{view.name}</span>
                    {view.tableName && (
                      <Link
                        href={`/data/${view.tableId}`}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {view.tableName}
                      </Link>
                    )}
                    {view.filters.length > 0 && (
                      <Badge variant="secondary" className="flex-shrink-0 text-xs h-5">
                        <Filter className="h-2.5 w-2.5 mr-1" />
                        {view.filters.length}
                      </Badge>
                    )}
                    {view.sorting.length > 0 && (
                      <Badge variant="secondary" className="flex-shrink-0 text-xs h-5">
                        <ArrowUpDown className="h-2.5 w-2.5 mr-1" />
                        {view.sorting.length}
                      </Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditView(view)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Configure
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeletingView(view)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <ViewFormDialog
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        view={editingView}
        onSuccess={() => {
          setShowViewDialog(false);
          setEditingView(undefined);
          if (onViewsChange) {
            onViewsChange();
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingView} onOpenChange={() => setDeletingView(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete View</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingView?.name}"? This action cannot be undone.
              Any TableBlock components using this view may stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteView}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
