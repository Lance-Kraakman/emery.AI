'use client';

import React from 'react';
import type { AppDTO } from '@/app/mappers/puck-app-mapper';
import { Card, CardContent } from '@/components/ui/card';
import { AppWindow } from 'lucide-react';

interface AppCardProps {
  app: AppDTO;
  isSelected: boolean;
  onClick: () => void;
}

export function AppCard({ app, isSelected, onClick }: AppCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected
          ? 'ring-2 ring-primary bg-secondary'
          : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <AppWindow className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-foreground truncate">
                {app.name}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                /{app.slug}
              </p>
              {app.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {app.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
