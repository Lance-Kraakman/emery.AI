/**
 * Credit Breakdown Tabs Component
 *
 * Displays credit usage breakdowns by different dimensions (Model, Agent, User, Type)
 * with export to CSV functionality
 */
'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportCreditUsageCSV } from '@/app/actions/credits';
import { toast } from 'sonner';

export interface BreakdownItem {
  name: string;
  creditsUsed: number;
  executionCount: number;
  percentageOfTotal: number;
}

export interface CreditBreakdownTabsProps {
  organizationId: number;
  modelBreakdown: BreakdownItem[];
  isLoading?: boolean;
}

export function CreditBreakdownTabs({
  organizationId,
  modelBreakdown,
  isLoading = false,
}: CreditBreakdownTabsProps) {
  const handleExportCSV = async (dimension: 'model' | 'agent' | 'user' | 'type') => {
    try {
      const result = await exportCreditUsageCSV(organizationId, dimension);
      if (result.success && result.data) {
        // Create download link
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `credit-usage-${dimension}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success('Usage data exported successfully');
      } else {
        throw new Error(result.error || 'Failed to export data');
      }
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export data');
    }
  };

  const renderBreakdownTable = (
    data: BreakdownItem[],
    label: string,
    dimension: 'model' | 'agent' | 'user' | 'type'
  ) => (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="h-8" onClick={() => handleExportCSV(dimension)}>
          <Download className="h-3 w-3 mr-1.5" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </Button>
      </div>
      {isLoading ? (
        <div className="text-center py-6 text-sm text-muted-foreground">Loading...</div>
      ) : data.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">No usage data available</div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left">{label}</th>
                <th className="p-2 text-right">Credits</th>
                <th className="p-2 text-right">Executions</th>
                <th className="p-2 text-right">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-2 capitalize">{item.name}</td>
                  <td className="p-2 text-right font-medium">{item.creditsUsed.toFixed(2)}</td>
                  <td className="p-2 text-right">{item.executionCount}</td>
                  <td className="p-2 text-right">{item.percentageOfTotal.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Only Model breakdown is currently implemented
  // Agent, User, and Type breakdowns will be added in a future release
  return renderBreakdownTable(modelBreakdown, 'Model', 'model');
}
