import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RRule, Weekday } from 'rrule';
import { Checkbox } from '@/components/ui/checkbox';
import { useTimezoneSelect } from 'react-timezone-select';

interface ScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rrule: string) => void;
  initialRRule?: string;
}

const weekdays = [
  { name: 'Monday', value: RRule.MO },
  { name: 'Tuesday', value: RRule.TU },
  { name: 'Wednesday', value: RRule.WE },
  { name: 'Thursday', value: RRule.TH },
  { name: 'Friday', value: RRule.FR },
  { name: 'Saturday', value: RRule.SA },
  { name: 'Sunday', value: RRule.SU },
];

const ScheduleDialog: React.FC<ScheduleDialogProps> = ({ isOpen, onClose, onSave, initialRRule }) => {
  const [startDate, setStartDate] = useState(new Date());
  const [freq, setFreq] = useState(RRule.WEEKLY);
  const [interval, setInterval] = useState(1);
  const [byweekday, setByweekday] = useState<Weekday[]>([]);
  const [time, setTime] = useState('10:00');
  const [tzid, setTzid] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const { options } = useTimezoneSelect({ labelStyle: 'original' });

  useEffect(() => {
    if (initialRRule) {
      try {
        const rule = RRule.fromString(initialRRule);
        const options = rule.options;
        setStartDate(options.dtstart);
        setFreq(options.freq);
        setInterval(options.interval);
        setByweekday((options.byweekday as number[]).map(day => new Weekday(day)));
        setTime(`${options.dtstart.getHours()}:${options.dtstart.getMinutes()}`);
        setTzid(options.tzid || Intl.DateTimeFormat().resolvedOptions().timeZone);
      } catch (error) {
        console.error('Invalid rrule string:', error);
      }
    }
  }, [initialRRule]);

  const handleSave = () => {
    const [hour, minute] = time.split(':').map(Number);
    const dtstart = new Date(startDate);
    dtstart.setHours(hour, minute);

    const rule = new RRule({
      freq,
      interval,
      dtstart,
      byweekday: byweekday.length > 0 ? byweekday : null,
      tzid,
    });
    onSave(rule.toString());
    onClose();
  };

  const getFrequencyUnit = () => {
    switch (freq) {
      case RRule.DAILY:
        return 'day(s)';
      case RRule.WEEKLY:
        return 'week(s)';
      case RRule.MONTHLY:
        return 'month(s)';
      case RRule.YEARLY:
        return 'year(s)';
      default:
        return '';
    }
  };

  const getSummary = () => {
    try {
      const [hour, minute] = time.split(':').map(Number);
      const dtstart = new Date(startDate);
      dtstart.setHours(hour, minute);

      const rule = new RRule({
        freq,
        interval,
        dtstart,
        byweekday: byweekday.length > 0 ? byweekday : null,
        tzid,
      });
      return rule.toText();
    } catch (error) {
      return 'Invalid schedule';
    }
  };

  const handleWeekdayChange = (weekday: Weekday) => {
    setByweekday((prev) =>
      prev.includes(weekday)
        ? prev.filter((day) => day !== weekday)
        : [...prev, weekday]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Schedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate.toISOString().split('T')[0]} onChange={(e) => setStartDate(new Date(e.target.value))} />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Timezone</Label>
            <Select onValueChange={setTzid} defaultValue={tzid}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Frequency</Label>
            <Select onValueChange={(value) => setFreq(Number(value))} defaultValue={String(RRule.WEEKLY)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(RRule.DAILY)}>Daily</SelectItem>
                <SelectItem value={String(RRule.WEEKLY)}>Weekly</SelectItem>
                <SelectItem value={String(RRule.MONTHLY)}>Monthly</SelectItem>
                <SelectItem value={String(RRule.YEARLY)}>Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {freq === RRule.WEEKLY && (
            <div>
              <Label>Repeat on</Label>
              <div className="flex space-x-2">
                {weekdays.map((day) => (
                  <div key={day.name} className="flex items-center space-x-1">
                    <Checkbox
                      checked={byweekday.includes(day.value)}
                      onCheckedChange={() => handleWeekdayChange(day.value)}
                    />
                    <Label>{day.name.substring(0, 3)}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label>Repeat every</Label>
            <div className="flex items-center space-x-2">
              <Input type="number" value={interval} onChange={(e) => setInterval(Number(e.target.value))} className="w-20" />
              <span>{getFrequencyUnit()}</span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Summary: {getSummary()}
          </div>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleDialog;
