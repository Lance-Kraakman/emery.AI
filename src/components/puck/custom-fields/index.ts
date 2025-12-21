/**
 * Custom Puck Fields - Index
 *
 * AIDEV-NOTE: Centralized exports for all custom Puck field configurations.
 * These are field definition helpers, not React components.
 */

// Data Source Selection
export {
  createDataSourceField,
  createDataSourceFieldForTable,
  type DataSourceFieldValue,
} from "./data-source-field";

// Field Mapping
export {
  createFieldMappingField,
  createSimpleFieldMappingField,
  type FieldMapping,
} from "./field-mapping-field";

// Sort Builder
export {
  createSortBuilderField,
  createSimpleSortBuilderField,
  createSingleSortField,
  type SortRule,
} from "./sort-builder-field";

// View Management
export { createViewManagementField } from "./view-management-field";

// Field Selector
export {
  createFieldSelectorField,
  type FieldSelectorFieldConfig,
} from "./field-selector-field";

// Link Action (Button/Link configuration)
export {
  createLinkActionField,
  type LinkActionConfig,
  type LinkActionType,
} from "./link-action-field";

// Actions (for Button, Link blocks)
export { createActionsField } from "./actions-field";

// Variable Label (for dynamic labels with {fieldName} support)
export { createVariableLabelField } from "./variable-label-field";

// Variable Text (for text/textarea fields with variable support)
export {
  createVariableTextField,
  type VariableTextFieldOptions,
} from "./variable-text-field";
