'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PageDTO } from '@/app/mappers/puck-page-mapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, EyeOff, Edit, Trash2, MoreVertical, Monitor, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { PageFormDialog } from './PageFormDialog';
import { deletePage } from '@/app/actions/puck-pages';
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

interface PagesSectionProps {
  appId: number;
  pages: PageDTO[];
  loading: boolean;
  onPagesChange?: () => void;
}

export function PagesSection({ appId, pages, loading, onPagesChange }: PagesSectionProps) {
  const router = useRouter();
  const [showPageDialog, setShowPageDialog] = useState(false);
  const [editingPage, setEditingPage] = useState<PageDTO | undefined>();
  const [deletingPage, setDeletingPage] = useState<PageDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddPage = () => {
    setEditingPage(undefined);
    setShowPageDialog(true);
  };

  const handleEditPageMetadata = (page: PageDTO) => {
    setEditingPage(page);
    setShowPageDialog(true);
  };

  const handleEditPage = (page: PageDTO) => {
    router.push(`/apps/${appId}/pages/${page.id}/edit`);
  };

  const handlePreviewPage = (page: PageDTO) => {
    router.push(`/apps/${appId}/pages/${page.id}/preview`);
  };

  const handleDeletePage = async () => {
    if (!deletingPage) return;

    try {
      setIsDeleting(true);
      const result = await deletePage(deletingPage.id, `/apps/${appId}`);

      if (!result.success) {
        toast.error(result.error || "Failed to delete page");
        return;
      }

      toast.success("Page deleted successfully");
      setDeletingPage(null);

      if (onPagesChange) {
        onPagesChange();
      }
    } catch (error) {
      console.error('Error deleting page:', error);
      toast.error("Failed to delete page");
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
              <CardTitle>Pages</CardTitle>
              <CardDescription>
                Manage pages within this app
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleAddPage}>
              <Plus className="h-4 w-4 mr-2" />
              Add Page
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading text="Loading pages..." />
          ) : pages.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-medium mb-1">No pages yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first page to start building with the visual editor
              </p>
              <Button size="sm" onClick={handleAddPage}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Page
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="flex items-center justify-between p-2 border rounded hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{page.name}</span>
                    <span className="text-xs text-muted-foreground truncate">/{page.slug}</span>
                    <Badge
                      variant={page.isPublic ? "default" : "secondary"}
                      className="flex-shrink-0 text-xs h-5"
                    >
                      {page.isPublic ? (
                        <>
                          <Eye className="h-2.5 w-2.5 mr-1" />
                          Public
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-2.5 w-2.5 mr-1" />
                          Private
                        </>
                      )}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handlePreviewPage(page)}>
                        <Monitor className="h-4 w-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditPage(page)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Content
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditPageMetadata(page)}>
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeletingPage(page)}
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

      {/* Page Form Dialog */}
      <PageFormDialog
        isOpen={showPageDialog}
        onClose={() => {
          setShowPageDialog(false);
          setEditingPage(undefined);
        }}
        appId={appId}
        page={editingPage}
        onSuccess={() => {
          if (onPagesChange) {
            onPagesChange();
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPage} onOpenChange={() => setDeletingPage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the page "{deletingPage?.name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePage}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
