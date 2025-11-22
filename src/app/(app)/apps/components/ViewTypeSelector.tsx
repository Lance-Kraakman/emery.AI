/**
 * ViewTypeSelector Component
 *
 * Reusable component for selecting view type (Grid, Metric, or Chart).
 * Used in ViewFormDialog for creating new views.
 */

import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ViewTypeSelectorProps {
  value: 'grid' | 'metric' | 'chart' | 'form';
  onChange: (value: 'grid' | 'metric' | 'chart' | 'form') => void;
  disabled?: boolean;
  supportedTypes?: Array<'grid' | 'metric' | 'chart' | 'form'>;
}

export function ViewTypeSelector({ value, onChange, disabled, supportedTypes }: ViewTypeSelectorProps) {
  const allTypes = [
    { value: 'grid' as const, label: 'Grid' },
    { value: 'metric' as const, label: 'Metric' },
    { value: 'chart' as const, label: 'Chart' },
    { value: 'form' as const, label: 'Form' },
  ];

  const availableTypes = supportedTypes
    ? allTypes.filter(type => supportedTypes.includes(type.value))
    : allTypes;

  return (
    <div className="space-y-2">
      <Label>View Type</Label>
      <Tabs value={value} onValueChange={(val) => onChange(val as any)} className={disabled ? 'opacity-50 pointer-events-none' : ''}>
        <TabsList className={`grid w-full grid-cols-${availableTypes.length}`}>
          {availableTypes.map(type => (
            <TabsTrigger key={type.value} value={type.value}>
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
