'use client';

import React, { useState, useMemo } from 'react';
import { Calendar, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ScheduleManager from '@/app/(app)/agents/components/ScheduleManager';
import { RRule } from 'rrule';

interface ScheduleConfigDialogProps {
  rrule: string;
  timezone: string;
  onRRuleChange: (rrule: string) => void;
  onTimezoneChange: (timezone: string) => void;
  disabled?: boolean;
}

function getScheduleSummary(rrule: string): string {
  if (!rrule) return 'Not configured';
  try {
    const rule = RRule.fromString(rrule);
    return rule.toText();
  } catch {
    return 'Invalid schedule';
  }
}

export function ScheduleConfigDialog({
  rrule,
  timezone,
  onRRuleChange,
  disabled,
}: ScheduleConfigDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const summary = useMemo(() => getScheduleSummary(rrule), [rrule]);

  return (
    <>
      <div className="flex items-center gap-2 p-2 border rounded-lg">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-xs text-muted-foreground truncate">
          {summary}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className="h-6 px-2 text-[10px]"
        >
          <Settings2 className="h-3 w-3 mr-1" />
          Configure
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Configure Schedule</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <ScheduleManager
              initialRRule={rrule}
              onScheduleChange={(newRrule) => {
                onRRuleChange(newRrule);
              }}
              isCreationMode={false}
            />
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setIsOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
