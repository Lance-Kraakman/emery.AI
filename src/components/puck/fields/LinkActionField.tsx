'use client';

import React, { useState, useEffect } from 'react';
import { FieldLabel } from '@measured/puck';
import { useParams } from 'next/navigation';
import type { LinkActionConfig, LinkActionFieldConfig, LinkActionType } from '../custom-fields/link-action-field';
import type { PageDTO } from '@/app/mappers/puck-page-mapper';
import { getPages } from '@/app/actions/puck-pages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ExternalLink, ChevronDown, Link as LinkIcon, LogIn, LogOut, FileText, AlertCircle } from 'lucide-react';

interface LinkActionFieldProps {
  value?: LinkActionConfig;
  onChange: (value: LinkActionConfig) => void;
  field: LinkActionFieldConfig;
  name: string;
  readOnly?: boolean;
}

const ACTION_TYPE_LABELS: Record<LinkActionType, string> = {
  none: 'No Action',
  page: 'Link to Page',
  url: 'External URL',
  signIn: 'Sign In',
  signOut: 'Sign Out',
};

const ACTION_TYPE_ICONS: Record<LinkActionType, React.ReactNode> = {
  none: null,
  page: <FileText className="h-4 w-4" />,
  url: <ExternalLink className="h-4 w-4" />,
  signIn: <LogIn className="h-4 w-4" />,
  signOut: <LogOut className="h-4 w-4" />,
};

export function LinkActionFieldRenderer({
  value,
  onChange,
  field,
  name,
  readOnly = false,
}: LinkActionFieldProps) {
  const params = useParams();
  const appId = params?.id ? parseInt(params.id as string) : null;

  const [pages, setPages] = useState<PageDTO[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Initialize value with defaults if not set
  const currentValue: LinkActionConfig = value || {
    actionType: field.defaultActionType || 'none',
  };

  // Load pages when component mounts and appId is available
  useEffect(() => {
    if (appId && field.allowedActionTypes?.includes('page')) {
      loadPages();
    }
  }, [appId]);

  const loadPages = async () => {
    if (!appId) return;

    try {
      setLoadingPages(true);
      const result = await getPages(appId);

      if (result.success && result.data) {
        setPages(result.data);
      } else {
        console.error('Error loading pages:', result.error);
      }
    } catch (error) {
      console.error('Error loading pages:', error);
    } finally {
      setLoadingPages(false);
    }
  };

  const updateValue = (updates: Partial<LinkActionConfig>) => {
    onChange({ ...currentValue, ...updates });
  };

  const handleActionTypeChange = (actionType: LinkActionType) => {
    // Reset related fields when changing action type
    onChange({
      actionType,
      pageId: undefined,
      url: undefined,
      openInNewTab: undefined,
      redirectAfter: undefined,
      anchorId: currentValue.anchorId, // Preserve anchor ID
      customHref: currentValue.customHref, // Preserve custom href
    });
  };

  // Generate preview text
  const getPreviewText = (): string => {
    const anchor = currentValue.anchorId ? `#${currentValue.anchorId}` : '';

    if (currentValue.customHref) {
      return currentValue.customHref + anchor;
    }

    switch (currentValue.actionType) {
      case 'page':
        if (currentValue.pageId) {
          const page = pages.find(p => p.id === currentValue.pageId);
          const baseText = page ? `Page: ${page.name} (${page.slug})` : `Page ID: ${currentValue.pageId}`;
          return baseText + anchor;
        }
        return 'No page selected';

      case 'url':
        const baseUrl = currentValue.url || 'No URL specified';
        return baseUrl + anchor;

      case 'signIn':
        return `Sign in${currentValue.redirectAfter ? ` → ${currentValue.redirectAfter}` : ''}${anchor}`;

      case 'signOut':
        return `Sign out${currentValue.redirectAfter ? ` → ${currentValue.redirectAfter}` : ''}${anchor}`;

      case 'none':
      default:
        return 'No action configured';
    }
  };

  return (
    <FieldLabel label={field.label || 'Link Action'}>
      <div className="space-y-4">
        {/* Action Type Selector */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Action Type</Label>
          <Select
            value={currentValue.actionType}
            onValueChange={(val) => handleActionTypeChange(val as LinkActionType)}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.allowedActionTypes?.map((type) => (
                <SelectItem key={type} value={type}>
                  <div className="flex items-center gap-2">
                    {ACTION_TYPE_ICONS[type]}
                    <span>{ACTION_TYPE_LABELS[type]}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page Selection */}
        {currentValue.actionType === 'page' && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Select Page</Label>
            <Select
              value={currentValue.pageId?.toString()}
              onValueChange={(val) => updateValue({ pageId: parseInt(val) })}
              disabled={readOnly || loadingPages}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingPages
                      ? 'Loading pages...'
                      : pages.length === 0
                      ? 'No pages available'
                      : 'Select a page'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {pages.map((page) => (
                  <SelectItem key={page.id} value={page.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{page.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({page.slug})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!appId && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 p-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <p className="text-xs text-destructive">
                  Unable to load pages: App context not available
                </p>
              </div>
            )}
          </div>
        )}

        {/* URL Input */}
        {currentValue.actionType === 'url' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium">URL</Label>
              <Input
                type="url"
                value={currentValue.url || ''}
                onChange={(e) => updateValue({ url: e.target.value })}
                placeholder="https://example.com"
                disabled={readOnly}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`${name}-new-tab`}
                checked={currentValue.openInNewTab || false}
                onCheckedChange={(checked) =>
                  updateValue({ openInNewTab: checked as boolean })
                }
                disabled={readOnly}
              />
              <Label
                htmlFor={`${name}-new-tab`}
                className="text-xs font-normal cursor-pointer"
              >
                Open in new tab
              </Label>
            </div>
          </div>
        )}

        {/* Sign In/Out Redirect */}
        {(currentValue.actionType === 'signIn' || currentValue.actionType === 'signOut') && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Redirect After (Optional)</Label>
            <Input
              type="text"
              value={currentValue.redirectAfter || ''}
              onChange={(e) => updateValue({ redirectAfter: e.target.value })}
              placeholder="/"
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to stay on current page
            </p>
          </div>
        )}

        {/* Anchor ID - Optional for all action types */}
        {currentValue.actionType !== 'none' && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Anchor ID (Optional)</Label>
            <Input
              type="text"
              value={currentValue.anchorId || ''}
              onChange={(e) => updateValue({ anchorId: e.target.value })}
              placeholder="hero-section"
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground">
              Link to a specific section on the page (e.g., #hero-section)
            </p>
          </div>
        )}

        {/* Advanced: Custom HREF Override */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-between p-0 h-auto font-normal text-xs"
              disabled={readOnly}
            >
              <span className="text-muted-foreground">Advanced: Custom Override</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isAdvancedOpen ? 'transform rotate-180' : ''
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            <Label className="text-xs font-medium">Custom HREF</Label>
            <Input
              type="text"
              value={currentValue.customHref || ''}
              onChange={(e) => updateValue({ customHref: e.target.value })}
              placeholder="/custom/path"
              disabled={readOnly}
            />
            <div className="mt-2 flex items-start gap-2 rounded-md border border-border bg-muted/50 p-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Custom HREF overrides all other settings. Use this for full manual control.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Preview */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-start gap-2">
            <LinkIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-1">Preview</p>
              <p className="text-xs font-mono bg-muted/50 p-2 rounded-md break-all">
                {getPreviewText()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </FieldLabel>
  );
}
