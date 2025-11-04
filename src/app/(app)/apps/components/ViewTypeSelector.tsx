/**
 * ViewTypeSelector Component
 *
 * Reusable component for selecting view type (Grid, Metric, or Chart).
 * Used in ViewFormDialog for creating new views.
 */

import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ViewTypeSelectorProps {
  value: 'grid' | 'metric' | 'chart';
  onChange: (value: 'grid' | 'metric' | 'chart') => void;
  disabled?: boolean;
}

export function ViewTypeSelector({ value, onChange, disabled }: ViewTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>View Type</Label>
      <Tabs value={value} onValueChange={(val) => onChange(val as any)} className={disabled ? 'opacity-50 pointer-events-none' : ''}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="grid">Grid</TabsTrigger>
          <TabsTrigger value="metric">Metric</TabsTrigger>
          <TabsTrigger value="chart">Chart</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
