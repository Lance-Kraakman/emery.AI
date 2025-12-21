'use client';

/**
 * ConditionalBlock - Conditionally render children based on state, params, or row data
 *
 * AIDEV-NOTE: Uses flat namespace for state - no containers.
 * State variables are accessed directly by key.
 */

import React, { useEffect, useReducer, useMemo, type ComponentType } from 'react';
import { ComponentConfig } from '@measured/puck';
import { useStateContext } from '../../contexts/StateContext';
import { useRowData } from '../../contexts/RowDataContext';
import { usePageContext } from '../../contexts/PageContext';

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
export type ConditionSourceType = 'state' | 'uiFlag' | 'params' | 'rowData';

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
}: ConditionalBlockProps) {
  const stateContext = useStateContext();
  const rowContext = useRowData();
  const pageContext = usePageContext();

  // Force re-render counter for state subscriptions
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Subscribe to state changes if using state/uiFlag source
  useEffect(() => {
    if (!stateContext) return;
    if (sourceType !== 'state' && sourceType !== 'uiFlag') return;

    const unsubscribe = stateContext.subscribe(forceUpdate);
    return unsubscribe;
  }, [stateContext, sourceType]);

  // Get the current value based on source type
  const currentValue = useMemo(() => {
    switch (sourceType) {
      case 'state':
        if (!stateContext || !stateKey) return undefined;
        return stateContext.getValue(stateKey);

      case 'uiFlag':
        if (!stateContext || !stateKey) return undefined;
        return stateContext.getUIFlag(stateKey);

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

  // Render children only if condition is met
  if (!conditionMet) {
    return <></>;
  }

  return Children ? <Children /> : <></>;
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
        { value: 'uiFlag', label: 'UI Flag (boolean)' },
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
    if (sourceType === 'state' || sourceType === 'uiFlag') {
      sourceFields = {
        stateKey: {
          ...fields.stateKey,
          label: sourceType === 'uiFlag' ? 'UI Flag' : 'State Variable',
        },
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
    };
  },

  defaultProps: {
    sourceType: 'uiFlag',
    stateKey: '',
    operator: 'truthy',
    invert: false,
  },

  render: ConditionalBlockComponent,
};
