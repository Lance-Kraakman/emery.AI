'use client';

/**
 * TemplateCard Component
 *
 * Displays a template with metadata, type badge, and action buttons.
 * Supports both builtin templates and saved (organization) templates.
 */

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Database,
  Bot,
  LayoutGrid,
  Download,
  Trash2,
  Copy,
  Play,
  Save,
  Lock
} from 'lucide-react';
import type { TemplateDTO, BuiltinTemplateInfo, TemplateEntityType } from '@/ddd/domain/templates/types';

// =============================================================================
// Types
// =============================================================================

export interface TemplateCardProps {
  /** Template data - either a saved template or builtin info */
  template: TemplateDTO | BuiltinTemplateInfo;
  /** Whether this is a builtin template */
  isBuiltin: boolean;
  /** Apply template action */
  onApply?: () => void;
  /** Export/download template */
  onExport?: () => void;
  /** Delete template (only for saved templates) */
  onDelete?: () => void;
  /** Save builtin to library */
  onSaveToLibrary?: () => void;
  /** Loading state for actions */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getEntityTypeIcon(entityType: TemplateEntityType) {
  switch (entityType) {
    case 'skill':
      return <Sparkles className="h-4 w-4" />;
    case 'database':
      return <Database className="h-4 w-4" />;
    case 'agent':
      return <Bot className="h-4 w-4" />;
    case 'org_section':
      return <LayoutGrid className="h-4 w-4" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function getEntityTypeColor(entityType: TemplateEntityType): string {
  switch (entityType) {
    case 'skill':
      return 'bg-violet-500/10 text-violet-600 border-violet-500/20';
    case 'database':
      return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    case 'agent':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'org_section':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    default:
      return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  }
}

function getEntityTypeLabel(entityType: TemplateEntityType): string {
  switch (entityType) {
    case 'skill':
      return 'Skill';
    case 'database':
      return 'Database';
    case 'agent':
      return 'Agent';
    case 'org_section':
      return 'Org Section';
    case 'table':
      return 'Table';
    case 'app':
      return 'App';
    case 'organization':
      return 'Organization';
    default:
      return entityType;
  }
}

// =============================================================================
// Component
// =============================================================================

export function TemplateCard({
  template,
  isBuiltin,
  onApply,
  onExport,
  onDelete,
  onSaveToLibrary,
  loading = false,
  disabled = false,
}: TemplateCardProps) {
  const entityType = template.entityType;
  const tags = template.tags || [];

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <div className={`p-1 rounded ${getEntityTypeColor(entityType)} shrink-0`}>
              {getEntityTypeIcon(entityType)}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-medium line-clamp-2 leading-tight">
                {template.name}
              </CardTitle>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${getEntityTypeColor(entityType)}`}>
                  {getEntityTypeLabel(entityType)}
                </Badge>
                {template.category && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {template.category}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {isBuiltin && (
            <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 h-5 gap-0.5">
              <Lock className="h-2.5 w-2.5" />
              Builtin
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-3 pb-2">
        <CardDescription className="line-clamp-2 text-xs">
          {template.description || 'No description provided'}
        </CardDescription>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0 h-4">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="px-3 pb-3 pt-0 gap-1.5">
        {onApply && (
          <Button
            size="sm"
            onClick={onApply}
            disabled={loading || disabled}
            className="h-7 text-xs gap-1"
          >
            <Play className="h-3 w-3" />
            Apply
          </Button>
        )}

        {isBuiltin && onSaveToLibrary && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSaveToLibrary}
            disabled={loading || disabled}
            className="h-7 px-2"
          >
            <Save className="h-3 w-3" />
          </Button>
        )}

        {onExport && (
          <Button
            size="sm"
            variant="outline"
            onClick={onExport}
            disabled={loading || disabled}
            className="h-7 px-2"
          >
            <Download className="h-3 w-3" />
          </Button>
        )}

        {!isBuiltin && onDelete && (
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={loading || disabled}
            className="h-7 px-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default TemplateCard;
