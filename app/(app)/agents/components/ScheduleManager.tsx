import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import { RRule } from 'rrule';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './ScheduleManager.css';
import CalendarToolbar from './CalendarToolbar';
import ScheduleDialog from './ScheduleDialog';

const localizer = momentLocalizer(moment);

interface ScheduleManagerProps {
  agentId: number;
  initialRRule?: string;
  onScheduleChange: (rrule: string) => void;
}

const ScheduleManager: React.FC<ScheduleManagerProps> = ({ agentId, initialRRule, onScheduleChange }) => {
  const [rrule, setRrule] = useState(initialRRule || '');
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState(Views.MONTH);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);

  const events = useMemo(() => {
    if (!rrule) return [];
    try {
      const rule = RRule.fromString(rrule);
      const now = new Date();
      const events = rule.between(moment(now).startOf('year').toDate(), moment(now).endOf('year').toDate());
      return events.map((date) => ({
        start: date,
        end: date,
        title: 'Scheduled Event',
      }));
    } catch (error) {
      console.error('Invalid rrule string:', error);
      return [];
    }
  }, [rrule]);

  const handleSaveSchedule = async (newRrule: string) => {
    setRrule(newRrule);
    onScheduleChange(newRrule);
  };

  const onNavigate = useCallback((action: 'PREV' | 'NEXT' | 'TODAY') => {
    let newDate = new Date(date);
    if (action === 'PREV') {
      newDate.setMonth(date.getMonth() - 1);
    } else if (action === 'NEXT') {
      newDate.setMonth(date.getMonth() + 1);
    } else if (action === 'TODAY') {
      newDate = new Date();
    }
    setDate(newDate);
  }, [date, setDate]);

  const onView = useCallback((newView: any) => setView(newView), [setView]);

  return (
    <div className="h-[500px]">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        selectable
        date={date}
        view={view}
        onView={onView}
        components={{
          toolbar: (props) => (
            <CalendarToolbar
              {...props}
              onNavigate={onNavigate}
              label={moment(date).format('MMMM YYYY')}
              onScheduleClick={() => setIsScheduleDialogOpen(true)}
            />
          ),
        }}
      />
      <ScheduleDialog
        isOpen={isScheduleDialogOpen}
        onClose={() => setIsScheduleDialogOpen(false)}
        onSave={handleSaveSchedule}
        initialRRule={rrule}
      />
    </div>
  );
};

export default ScheduleManager;
