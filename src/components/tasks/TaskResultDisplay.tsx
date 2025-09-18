'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/src/components/ui/collapsible';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { Badge } from '@/src/components/ui/badge';

interface TaskResultDisplayProps {
  result: any;
  taskStatus: string;
  className?: string;
}

export function TaskResultDisplay({ result, taskStatus, className }: TaskResultDisplayProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Only show for completed tasks with results
  if (taskStatus !== 'completed' || !result) {
    return null;
  }

  const isJsonResult = typeof result === 'object';
  const displayResult = isJsonResult ? JSON.stringify(result, null, 2) : String(result);

  return (
    <div className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>Task Result</span>
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
            Completed
          </Badge>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2">
          <Card className="bg-green-500/5 border-green-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                <FileText className="h-4 w-4" />
                Execution Result
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-64 w-full rounded-md">
                <div className="p-4">
                  <pre className="text-xs font-mono text-muted-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                    {displayResult}
                  </pre>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}