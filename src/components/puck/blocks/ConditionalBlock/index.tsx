'use client';

/**
 * ConditionalBlock - Conditionally render children based on state, params, or row data
 *
 * AIDEV-NOTE: Uses flat namespace for state - no containers.
 * State variables are accessed directly by key via {state.key}.
 * Boolean variables are just regular state with type 'boolean'.
 *
 * In editor mode: Shows condition badge and always renders children
 * At runtime: Conditionally renders children based on condition
 */

import React, { useEffect, useReducer, useMemo, useState, type ComponentType } from 'react';
import { ComponentConfig } from '@measured/puck';
import { useStateContext } from '../../contexts/StateContext';
import { useRowData } from '../../contexts/RowDataContext';
import { useLinkContext, usePageContext } from '../../contexts/PageContext';
import { createStateKeyField } from '../../custom-fields/state-key-field';
import { GitBranch, Check, X, Eye, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Comparison operators for conditions
 */
export type ConditionOperator =
  | 'eq'       // equals
  | 'ne'       // not equals
  | 'gt'       // greater than
  | 'gte'      // greater than or equal
  | 'lt'       // less than
  | 'lte'      // less than or equal
  | 'contains' // string contains
  | 'truthy'   // value is truthy
  | 'falsy';   // value is falsy

/**
 * Value source type for the condition
 */
export type ConditionSourceType = 'state' | 'params' | 'rowData';

/**
 * ConditionalBlock Props
 */
export interface ConditionalBlockProps {
  /** Source type for the condition value */
  sourceType: ConditionSourceType;
  /** For state: variable key (flat namespace) */
  stateKey?: string;
  /** For params: query parameter name */
  paramName?: string;
  /** For rowData: field name */
  fieldName?: string;
  /** Comparison operator */
  operator: ConditionOperator;
  /** Value to compare against (for non-truthy/falsy operators) */
  compareValue?: string;
  /** Invert the condition result */
  invert: boolean;
  /** Child content to render when condition is true */
  children?: ComponentType<{
    className?: string;
    allow?: string[];
    disallow?: string[];
  }>;
  /** Child content to render when condition is false */
  elseContent?: ComponentType<{
    className?: string;
    allow?: string[];
    disallow?: string[];
  }>;
}

/**
 * Evaluate a condition
 */
function evaluateCondition(
  value: unknown,
  operator: ConditionOperator,
  compareValue?: string
): boolean {
  switch (operator) {
    case 'truthy':
      return Boolean(value);
    case 'falsy':
      return !value;
    case 'eq':
      // eslint-disable-next-line eqeqeq
      return value == compareValue;
    case 'ne':
      // eslint-disable-next-line eqeqeq
      return value != compareValue;
    case 'gt':
      return Number(value) > Number(compareValue);
    case 'gte':
      return Number(value) >= Number(compareValue);
    case 'lt':
      return Number(value) < Number(compareValue);
    case 'lte':
      return Number(value) <= Number(compareValue);
    case 'contains':
      return String(value).includes(String(compareValue));
    default:
      return false;
  }
}

/**
 * Format condition for display in editor badge
 */
function getConditionLabel(
  sourceType: ConditionSourceType,
  stateKey?: string,
  paramName?: string,
  fieldName?: string,
  operator?: ConditionOperator,
  compareValue?: string,
  invert?: boolean
): string {
  // Determine the source label
  let source = '?';
  if (sourceType === 'state' && stateKey) {
    source = `state.${stateKey}`;
  } else if (sourceType === 'params' && paramName) {
    source = `params.${paramName}`;
  } else if (sourceType === 'rowData' && fieldName) {
    source = `rowData.${fieldName}`;
  }

  // Determine the operator label
  let opLabel = '';
  switch (operator) {
    case 'truthy': opLabel = 'is true'; break;
    case 'falsy': opLabel = 'is false'; break;
    case 'eq': opLabel = `= "${compareValue || ''}"`; break;
    case 'ne': opLabel = `!= "${compareValue || ''}"`; break;
    case 'gt': opLabel = `> ${compareValue || ''}`; break;
    case 'gte': opLabel = `>= ${compareValue || ''}`; break;
    case 'lt': opLabel = `< ${compareValue || ''}`; break;
    case 'lte': opLabel = `<= ${compareValue || ''}`; break;
    case 'contains': opLabel = `contains "${compareValue || ''}"`; break;
    default: opLabel = '';
  }

  return `${invert ? 'NOT ' : ''}{${source}} ${opLabel}`;
}

/**
 * ConditionalBlock - Conditionally render children based on state, params, or row data
 */
function ConditionalBlockComponent({
  sourceType,
  stateKey,
  paramName,
  fieldName,
  operator,
  compareValue,
  invert,
  children: Children,
  elseContent: ElseContent,
}: ConditionalBlockProps) {
  const stateContext = useStateContext();
  const rowContext = useRowData();
  const pageContext = usePageContext();

  // Get editing context from page context
  const { isEditing } = useLinkContext();

  // Preview/Edit mode state
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [previewBranch, setPreviewBranch] = useState<'true' | 'else'>('true');

  // Force re-render counter for state subscriptions
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Subscribe to state changes if using state source
  useEffect(() => {
    if (!stateContext) return;
    if (sourceType !== 'state') return;

    const unsubscribe = stateContext.subscribe(forceUpdate);
    return unsubscribe;
  }, [stateContext, sourceType]);

  // Get the current value based on source type
  const currentValue = useMemo(() => {
    switch (sourceType) {
      case 'state':
        if (!stateContext || !stateKey) return undefined;
        return stateContext.getValue(stateKey);

      case 'params':
        if (!pageContext || !paramName) return undefined;
        return pageContext.params[paramName];

      case 'rowData':
        if (!rowContext || !fieldName) return undefined;
        return rowContext.resolveRowDataVariable(fieldName);

      default:
        return undefined;
    }
  }, [sourceType, stateContext, stateKey, pageContext, paramName, rowContext, fieldName]);

  // Evaluate the condition
  const conditionMet = useMemo(() => {
    const result = evaluateCondition(currentValue, operator, compareValue);
    return invert ? !result : result;
  }, [currentValue, operator, compareValue, invert]);

  // Update preview branch when condition changes (default to actual state)
  useEffect(() => {
    setPreviewBranch(conditionMet ? 'true' : 'else');
  }, [conditionMet]);

  // Get condition label for editor display
  const conditionLabel = getConditionLabel(
    sourceType,
    stateKey,
    paramName,
    fieldName,
    operator,
    compareValue,
    invert
  );

  // Editor mode: Show condition badge with preview/edit toggle
  if (isEditing) {
    return (
      <div className="relative border-2 border-dashed border-blue-300 rounded-lg p-3 min-h-[60px]">
        {/* Condition badge at top with mode toggle */}
        <div className="absolute -top-3 left-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 font-mono">
          <GitBranch className="h-3 w-3" />
          <span className="max-w-[150px] truncate">{conditionLabel}</span>
          {conditionMet ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <X className="h-3 w-3 text-red-500" />
          )}

          {/* Divider */}
          <div className="w-px h-3 bg-blue-300 mx-1" />

          {/* Edit/Preview toggle */}
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewMode('edit'); }}
              className={cn(
                "p-0.5 rounded transition-colors",
                viewMode === 'edit' ? "bg-blue-200" : "hover:bg-blue-200/50"
              )}
              title="Edit mode - show both branches"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewMode('preview'); }}
              className={cn(
                "p-0.5 rounded transition-colors",
                viewMode === 'preview' ? "bg-blue-200" : "hover:bg-blue-200/50"
              )}
              title="Preview mode - show selected branch"
            >
              <Eye className="h-3 w-3" />
            </button>
          </div>

          {/* Branch toggle (only in preview mode) */}
          {viewMode === 'preview' && (
            <>
              <div className="w-px h-3 bg-blue-300 mx-1" />
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPreviewBranch('true'); }}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors",
                    previewBranch === 'true' ? "bg-green-200 text-green-800" : "hover:bg-blue-200/50"
                  )}
                >
                  True
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPreviewBranch('else'); }}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors",
                    previewBranch === 'else' ? "bg-orange-200 text-orange-800" : "hover:bg-blue-200/50"
                  )}
                >
                  Else
                </button>
              </div>
            </>
          )}
        </div>

        {viewMode === 'edit' ? (
          // Edit mode: Show both branches
          <>
            {/* IF TRUE section */}
            <div className="mt-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">If True</div>
              {Children ? (
                <Children />
              ) : (
                <div className="text-muted-foreground text-sm py-4 text-center border-2 border-dashed rounded-md">
                  Drop content here
                </div>
              )}
            </div>

            {/* ELSE section */}
            <div className="mt-3 pt-3 border-t border-dashed border-blue-300">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Else</div>
              {ElseContent ? (
                <ElseContent />
              ) : (
                <div className="text-muted-foreground text-sm py-4 text-center border-2 border-dashed rounded-md">
                  Drop content here (optional)
                </div>
              )}
            </div>
          </>
        ) : (
          // Preview mode: Show only selected branch
          <div className="mt-2">
            {previewBranch === 'true' ? (
              Children ? <Children /> : (
                <div className="text-muted-foreground text-sm py-4 text-center border-2 border-dashed rounded-md">
                  No content in True branch
                </div>
              )
            ) : (
              ElseContent ? <ElseContent /> : (
                <div className="text-muted-foreground text-sm py-4 text-center border-2 border-dashed rounded-md">
                  No content in Else branch
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  // Runtime: Conditional rendering
  if (conditionMet) {
    return Children ? <Children /> : <></>;
  }

  return ElseContent ? <ElseContent /> : <></>;
}

/**
 * ConditionalBlock Puck configuration
 */
export const ConditionalBlock: ComponentConfig<ConditionalBlockProps> = {
  label: 'Conditional',
  fields: {
    sourceType: {
      type: 'select',
      label: 'Value Source',
      options: [
        { value: 'state', label: 'State Variable' },
        { value: 'params', label: 'URL Parameter' },
        { value: 'rowData', label: 'Row Data' },
      ],
    },
    stateKey: {
      type: 'text',
      label: 'State Key',
    },
    paramName: {
      type: 'text',
      label: 'Parameter Name',
    },
    fieldName: {
      type: 'text',
      label: 'Field Name',
    },
    operator: {
      type: 'select',
      label: 'Operator',
      options: [
        { value: 'truthy', label: 'Is Truthy' },
        { value: 'falsy', label: 'Is Falsy' },
        { value: 'eq', label: 'Equals' },
        { value: 'ne', label: 'Not Equals' },
        { value: 'gt', label: 'Greater Than' },
        { value: 'gte', label: 'Greater or Equal' },
        { value: 'lt', label: 'Less Than' },
        { value: 'lte', label: 'Less or Equal' },
        { value: 'contains', label: 'Contains' },
      ],
    },
    compareValue: {
      type: 'text',
      label: 'Compare Value',
    },
    invert: {
      type: 'radio',
      label: 'Invert Condition',
      options: [
        { value: false, label: 'No' },
        { value: true, label: 'Yes' },
      ],
    },
    children: {
      type: 'slot',
      label: 'If True',
    },
    elseContent: {
      type: 'slot',
      label: 'Else',
    },
  },

  resolveFields: (data, { fields }) => {
    const sourceType = data.props.sourceType;
    const operator = data.props.operator;

    // Base fields
    const baseFields = {
      sourceType: fields.sourceType,
    };

    // Source-specific fields
    let sourceFields = {};
    if (sourceType === 'state') {
      sourceFields = {
        stateKey: createStateKeyField({
          label: 'State Variable',
          placeholder: 'Select a variable...',
        }),
      };
    } else if (sourceType === 'params') {
      sourceFields = {
        paramName: fields.paramName,
      };
    } else if (sourceType === 'rowData') {
      sourceFields = {
        fieldName: fields.fieldName,
      };
    }

    // Operator field
    const operatorFields = {
      operator: fields.operator,
    };

    // Compare value (only for non-truthy/falsy operators)
    const compareFields = operator !== 'truthy' && operator !== 'falsy'
      ? { compareValue: fields.compareValue }
      : {};

    return {
      ...baseFields,
      ...sourceFields,
      ...operatorFields,
      ...compareFields,
      invert: fields.invert,
      children: fields.children,
      elseContent: fields.elseContent,
    };
  },

  defaultProps: {
    sourceType: 'state',
    stateKey: '',
    operator: 'truthy',
    invert: false,
  },

  render: ConditionalBlockComponent,
};
