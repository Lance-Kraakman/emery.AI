/**
 * SpendingLimitControl Component
 *
 * Allows users to set and manage their overage spending limit
 */
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Shield, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/billing/utils';
import { toast } from 'sonner';

export interface SpendingLimitControlProps {
  currentLimit: number | null;
  onSave: (newLimit: number | null) => Promise<void>;
  minLimit?: number;
  maxLimit?: number;
}

export function SpendingLimitControl({
  currentLimit,
  onSave,
  minLimit = 5,
  maxLimit = 10000,
}: SpendingLimitControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [limitValue, setLimitValue] = useState(currentLimit?.toString() || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    try {
      setIsLoading(true);

      const numericLimit = limitValue === '' ? null : parseFloat(limitValue);

      // Validation
      if (numericLimit !== null) {
        if (isNaN(numericLimit)) {
          toast.error('Please enter a valid number');
          return;
        }

        if (numericLimit < minLimit) {
          toast.error(`Minimum limit is ${formatCurrency(minLimit)}`);
          return;
        }

        if (numericLimit > maxLimit) {
          toast.error(`Maximum limit is ${formatCurrency(maxLimit)}`);
          return;
        }
      }

      await onSave(numericLimit);

      toast.success(
        numericLimit === null
          ? 'Spending limit removed - unlimited overage allowed'
          : `Spending limit set to ${formatCurrency(numericLimit)}`
      );

      setIsEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update spending limit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setLimitValue(currentLimit?.toString() || '');
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Spending Limit</CardTitle>
        </div>
        <CardDescription>
          Control your maximum monthly overage spending to prevent unexpected charges
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Info Alert */}
        <Alert variant="default" className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
            When you exceed your monthly credit allowance, overage charges apply at $0.0025 per credit.
            Set a spending limit to cap your maximum overage cost.
          </AlertDescription>
        </Alert>

        {/* Current Limit Display / Edit Form */}
        {!isEditing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Current Limit</p>
                <p className="text-2xl font-bold">
                  {currentLimit === null ? (
                    <span className="text-muted-foreground">Unlimited</span>
                  ) : (
                    formatCurrency(currentLimit)
                  )}
                </p>
              </div>
              <Button onClick={() => setIsEditing(true)} variant="outline">
                {currentLimit === null ? 'Set Limit' : 'Edit'}
              </Button>
            </div>

            {currentLimit === null && (
              <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <AlertDescription className="text-yellow-800 dark:text-yellow-200 text-sm">
                  No spending limit set. Your organization can incur unlimited overage charges. We recommend
                  setting a limit to control costs.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spending-limit">Monthly Overage Limit (USD)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="spending-limit"
                    type="number"
                    min={minLimit}
                    max={maxLimit}
                    step="0.01"
                    value={limitValue}
                    onChange={(e) => setLimitValue(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty for unlimited overage. Range: ${minLimit} - ${maxLimit.toLocaleString()}
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isLoading} className="flex-1">
                {isLoading ? 'Saving...' : 'Save Limit'}
              </Button>
              <Button onClick={handleCancel} variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Examples */}
        <div className="pt-4 border-t space-y-2 text-xs text-muted-foreground">
          <p className="font-medium">Example scenarios:</p>
          <ul className="space-y-1 ml-4">
            <li>• $25 limit = 10,000 overage credits maximum</li>
            <li>• $100 limit = 40,000 overage credits maximum</li>
            <li>• Unlimited = No cap on overage usage</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
