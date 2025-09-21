'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfigurationCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  status?: 'configured' | 'partial' | 'empty';
  statusText?: string;
  summary?: React.ReactNode;
  onClick?: () => void;
  actionText?: string;
  className?: string;
  children?: React.ReactNode;
}

const statusStyles = {
  configured: 'bg-green-100 text-green-800 border-green-200',
  partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  empty: 'bg-gray-100 text-gray-600 border-gray-200'
};

export function ConfigurationCard({
  title,
  description,
  icon: Icon,
  status,
  statusText,
  summary,
  onClick,
  actionText = 'Configure',
  className,
  children
}: ConfigurationCardProps) {
  const isInteractive = !!onClick;

  const cardContent = (
    <>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {Icon && (
              <div className="p-1 bg-muted rounded-sm flex-shrink-0">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-medium text-foreground truncate">
                {title}
              </CardTitle>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {status && statusText && (
              <Badge
                variant="outline"
                className={cn("text-xs", statusStyles[status])}
              >
                {statusText}
              </Badge>
            )}
            {isInteractive && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {(summary || children) && (
        <CardContent className="pt-0 pb-1">
          {summary && (
            <div className="text-xs text-muted-foreground mb-1">
              {summary}
            </div>
          )}
          {children}
        </CardContent>
      )}

      {isInteractive && (
        <CardContent className="pt-0 pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            className="w-full h-7 text-xs"
          >
            {actionText}
          </Button>
        </CardContent>
      )}
    </>
  );

  if (isInteractive) {
    return (
      <Card
        className={cn(
          "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20",
          className
        )}
        onClick={onClick}
      >
        {cardContent}
      </Card>
    );
  }

  return (
    <Card className={className}>
      {cardContent}
    </Card>
  );
}