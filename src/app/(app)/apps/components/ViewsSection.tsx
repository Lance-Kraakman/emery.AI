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
  dataSources: ViewDTO[];
  loading: boolean;
  onDataSourcesChange?: () => void;
}

export function ViewsSection({ dataSources, loading, onDataSourcesChange }: ViewsSectionProps) {
  const [showDataSourceDialog, setShowDataSourceDialog] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<ViewDTO | undefined>();
  const [deletingDataSource, setDeletingDataSource] = useState<ViewDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddDataSource = () => {
    setEditingDataSource(undefined);
    setShowDataSourceDialog(true);
  };

  const handleEditDataSource = (dataSource: ViewDTO) => {
    setEditingDataSource(dataSource);
    setShowDataSourceDialog(true);
  };

  const handleDeleteDataSource = async () => {
    if (!deletingDataSource) return;

    try {
      setIsDeleting(true);
      const result = await deleteView(deletingDataSource.id);

      if (!result.success) {
        toast.error(result.error || "Failed to delete view");
        return;
      }

      toast.success("View deleted successfully");
      setDeletingDataSource(null);

      if (onDataSourcesChange) {
        onDataSourcesChange();
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
              <CardTitle>Data Sources</CardTitle>
              <CardDescription>
                Manage filtered and sorted views of your tables
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleAddDataSource}>
              <Plus className="h-4 w-4 mr-2" />
              Add Data Source
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading text="Loading views..." />
          ) : dataSources.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-medium mb-1">No views yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create custom views of your tables with filters and sorting for use in TableBlock components
              </p>
              <Button size="sm" onClick={handleAddDataSource}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Data Source
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {dataSources.map((dataSource) => (
                <div
                  key={dataSource.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-medium truncate">{dataSource.name}</h4>
                        {dataSource.filters.length > 0 && (
                          <Badge variant="secondary" className="flex-shrink-0">
                            <Filter className="h-3 w-3 mr-1" />
                            {dataSource.filters.length} filter{dataSource.filters.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {dataSource.sorting.length > 0 && (
                          <Badge variant="secondary" className="flex-shrink-0">
                            <ArrowUpDown className="h-3 w-3 mr-1" />
                            {dataSource.sorting.length} sort{dataSource.sorting.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {dataSource.description || `Table ID: ${dataSource.tableId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditDataSource(dataSource)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditDataSource(dataSource)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Configure
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeletingDataSource(dataSource)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <ViewFormDialog
        open={showDataSourceDialog}
        onOpenChange={setShowDataSourceDialog}
        dataSource={editingDataSource}
        onSuccess={() => {
          setShowDataSourceDialog(false);
          setEditingDataSource(undefined);
          if (onDataSourcesChange) {
            onDataSourcesChange();
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingDataSource} onOpenChange={() => setDeletingDataSource(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Data Source</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingDataSource?.name}"? This action cannot be undone.
              Any TableBlock components using this view may stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDataSource}
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
