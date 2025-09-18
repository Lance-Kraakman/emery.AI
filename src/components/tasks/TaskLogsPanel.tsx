'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/src/components/ui/collapsible';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { Badge } from '@/src/components/ui/badge';

interface TaskLogsPanelProps {
  logs: string[];
  taskStatus: string;
  className?: string;
}

export function TaskLogsPanel({ logs, taskStatus, className }: TaskLogsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!logs || logs.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Terminal className="h-4 w-4" />
          <span>Execution Logs</span>
          <Badge variant="outline" className="text-xs">
            {logs.length} entries
          </Badge>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2">
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Task Execution Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64 w-full rounded-md">
                <div className="p-4 space-y-1">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className="text-xs font-mono text-muted-foreground/90 break-all leading-relaxed hover:text-foreground transition-colors"
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}