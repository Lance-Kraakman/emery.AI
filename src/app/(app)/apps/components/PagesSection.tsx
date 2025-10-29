'use client';

import React from 'react';
import type { PageDTO } from '@/app/mappers/puck-page-mapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';

interface PagesSectionProps {
  appId: number;
  pages: PageDTO[];
  loading: boolean;
}

export function PagesSection({ appId, pages, loading }: PagesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pages</CardTitle>
            <CardDescription>
              Manage pages within this app
            </CardDescription>
          </div>
          <Button size="sm" disabled>
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
            <Button size="sm" disabled>
              <Plus className="h-4 w-4 mr-2" />
              Create First Page
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {pages.map((page) => (
              <div
                key={page.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium truncate">{page.name}</h4>
                      <Badge
                        variant={page.isPublished ? "default" : "secondary"}
                        className="flex-shrink-0"
                      >
                        {page.isPublished ? (
                          <>
                            <Eye className="h-3 w-3 mr-1" />
                            Published
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3 w-3 mr-1" />
                            Draft
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{page.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled>
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
