'use client';

import React, { useState } from 'react';
import { Plus, Wrench, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AddStepButtonProps {
  onAddStep: (type: 'TOOL_STEP' | 'CODE_STEP') => void;
  disabled?: boolean;
}

export function AddStepButton({ onAddStep, disabled }: AddStepButtonProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (type: 'TOOL_STEP' | 'CODE_STEP') => {
    onAddStep(type);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Step
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuItem
          onClick={() => handleSelect('TOOL_STEP')}
          className="cursor-pointer"
        >
          <Wrench className="h-4 w-4 mr-2" />
          <div>
            <div className="font-medium">Tool Step</div>
            <div className="text-xs text-muted-foreground">
              Execute with specific tools
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelect('CODE_STEP')}
          className="cursor-pointer"
        >
          <Code className="h-4 w-4 mr-2" />
          <div>
            <div className="font-medium">Code Step</div>
            <div className="text-xs text-muted-foreground">
              Execute code directly
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
