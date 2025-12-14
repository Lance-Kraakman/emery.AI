'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { Save, RefreshCw } from 'lucide-react';
import { updateOrganizationSettings } from '@/app/actions/organizations';
import { toast } from 'sonner';
import { ThemeToggle } from './ThemeToggle';

export interface SystemSettingsClientProps {
  organizationId: number;
  organizationTier: 'free' | 'pro' | 'max' | 'enterprise';
  currentModel: string | null;
  availableModels: string[];
}

export function SystemSettingsClient({
  organizationId,
  organizationTier,
  currentModel,
  availableModels,
}: SystemSettingsClientProps) {
  const [defaultModel, setDefaultModel] = useState<string | null>(currentModel);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const result = await updateOrganizationSettings({
        organizationId,
        defaultModel: defaultModel || null,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save settings');
      }

      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Toggle between light and dark mode
              </p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default-model">Default AI Model</Label>
            <p className="text-sm text-muted-foreground">
              Set the default model for all agents in this organization
            </p>
            <ModelSelector
              value={defaultModel}
              onChange={setDefaultModel}
              organizationTier={organizationTier}
              availableModels={availableModels.length > 0 ? availableModels : undefined}
              showInherit={false}
              requiredCapabilities={['toolCalling']}
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
