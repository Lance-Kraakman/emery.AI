import React from 'react';
import { Button } from '@/components/ui/button';

interface CalendarToolbarProps {
  onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY') => void;
  label: string;
  onScheduleClick: () => void;
}

const CalendarToolbar: React.FC<CalendarToolbarProps> = ({ onNavigate, label, onScheduleClick }) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        <Button onClick={() => onNavigate('TODAY')}>Today</Button>
        <Button onClick={() => onNavigate('PREV')}>Back</Button>
        <Button onClick={() => onNavigate('NEXT')}>Next</Button>
      </div>
      <div className="text-lg font-semibold">{label}</div>
      <Button onClick={onScheduleClick}>Schedule</Button>
    </div>
  );
};

export default CalendarToolbar;
