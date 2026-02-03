/**
 * Form View Configuration Value Objects
 *
 * Type-safe configuration for form views that create new table rows.
 * Supports multi-page forms, field validation, and conditional visibility.
 *
 * AIDEV-NOTE: Forms are for data entry only - they create rows, not display existing data.
 * Each form page contains a subset of table fields with validation rules.
 */

/**
 * Conditional Visibility Configuration
 * Controls when a field should be shown based on another field's value
 */
export interface ConditionalVisibility {
  dependsOn: number;                                    // Field ID this field depends on
  operator: 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty' | 'contains';
  value?: any;                                          // Value to compare against (not needed for is_empty/is_not_empty)
}

/**
 * Validation Rule Configuration
 * Type-specific validation rules for form fields
 */
export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'min_length' | 'max_length' | 'email' | 'url' | 'required';
  value?: any;                                          // Rule value (number for min/max, string for pattern, etc.)
  message: string;                                      // Error message to display
}

/**
 * Form Field Configuration
 * Configuration for a single field within a form page
 */
export interface FormFieldConfig {
  fieldId: number;                                      // Reference to TableField ID
  order: number;                                        // Display order within page (0-based)
  label?: string;                                       // Override field name for display
  helpText?: string;                                    // Helper text shown below field
  placeholder?: string;                                 // Input placeholder text
  required?: boolean;                                   // Override field.required (can't make required field optional)
  visible?: boolean;                                    // Default visibility state (default: true)
  conditionalVisibility?: ConditionalVisibility;       // Show/hide based on other field
  validationRules?: ValidationRule[];                  // Type-specific validation rules
  allowMultiple?: boolean;                             // Override field metadata's multiple setting (file/document fields)
  maxFiles?: number;                                   // Max file count when allowMultiple is true (file/document fields)
}

/**
 * Form Page Configuration
 * A single page in a multi-page form
 */
export interface FormPageConfig {
  id: string;                                           // Unique page identifier (UUID)
  title?: string;                                       // Page title (e.g., "Personal Information")
  description?: string;                                 // Page description/instructions
  fields: FormFieldConfig[];                           // Fields to display on this page
  order: number;                                        // Page order in form (0-based)
}

/**
 * Form View Configuration
 * Complete configuration for a form view
 */
export interface FormViewConfig {
  type: 'form';
  pages: FormPageConfig[];                             // Form pages (at least one required)
  submitButtonText?: string;                            // Custom submit button text (default: "Submit")
  successMessage?: string;                              // Message shown after successful submission
  redirectUrl?: string;                                 // URL to redirect to after submission (optional)
}

/**
 * Validation helpers for form configurations
 */
export class FormViewConfigValidator {
  /**
   * Validate complete form configuration
   */
  static validate(config: FormViewConfig): void {
    if (!config.pages || config.pages.length === 0) {
      throw new Error('Form view must have at least one page');
    }

    // Validate each page
    config.pages.forEach((page, index) => {
      this.validatePage(page, index);
    });

    // Validate page order is sequential and starts at 0
    const orders = config.pages.map(p => p.order).sort((a, b) => a - b);
    orders.forEach((order, index) => {
      if (order !== index) {
        throw new Error(`Page orders must be sequential starting at 0. Expected ${index}, got ${order}`);
      }
    });

    // Validate no duplicate page IDs
    const pageIds = config.pages.map(p => p.id);
    const uniquePageIds = new Set(pageIds);
    if (uniquePageIds.size !== pageIds.length) {
      throw new Error('Duplicate page IDs found in form configuration');
    }
  }

  /**
   * Validate single page configuration
   */
  private static validatePage(page: FormPageConfig, pageIndex: number): void {
    if (!page.id || page.id.trim().length === 0) {
      throw new Error(`Page ${pageIndex} must have a valid ID`);
    }

    if (!page.fields || page.fields.length === 0) {
      throw new Error(`Page "${page.id}" must have at least one field`);
    }

    if (typeof page.order !== 'number' || page.order < 0) {
      throw new Error(`Page "${page.id}" must have a valid order (non-negative number)`);
    }

    // Validate each field
    page.fields.forEach((field, fieldIndex) => {
      this.validateField(field, page.id, fieldIndex);
    });

    // Validate field order is sequential and starts at 0
    const orders = page.fields.map(f => f.order).sort((a, b) => a - b);
    orders.forEach((order, index) => {
      if (order !== index) {
        throw new Error(`Field orders in page "${page.id}" must be sequential starting at 0. Expected ${index}, got ${order}`);
      }
    });

    // Validate no duplicate field IDs within page
    const fieldIds = page.fields.map(f => f.fieldId);
    const uniqueFieldIds = new Set(fieldIds);
    if (uniqueFieldIds.size !== fieldIds.length) {
      throw new Error(`Duplicate field IDs found in page "${page.id}"`);
    }
  }

  /**
   * Validate single field configuration
   */
  private static validateField(field: FormFieldConfig, pageId: string, fieldIndex: number): void {
    if (typeof field.fieldId !== 'number' || field.fieldId <= 0) {
      throw new Error(`Field ${fieldIndex} in page "${pageId}" must have a valid fieldId (positive number)`);
    }

    if (typeof field.order !== 'number' || field.order < 0) {
      throw new Error(`Field ${field.fieldId} in page "${pageId}" must have a valid order (non-negative number)`);
    }

    // Validate conditional visibility if present
    if (field.conditionalVisibility) {
      this.validateConditionalVisibility(field.conditionalVisibility, field.fieldId, pageId);
    }

    // Validate validation rules if present
    if (field.validationRules) {
      field.validationRules.forEach((rule, ruleIndex) => {
        this.validateValidationRule(rule, field.fieldId, pageId, ruleIndex);
      });
    }
  }

  /**
   * Validate conditional visibility configuration
   */
  private static validateConditionalVisibility(
    condition: ConditionalVisibility,
    fieldId: number,
    pageId: string
  ): void {
    if (typeof condition.dependsOn !== 'number' || condition.dependsOn <= 0) {
      throw new Error(`Conditional visibility for field ${fieldId} in page "${pageId}" must have valid dependsOn field ID`);
    }

    if (condition.dependsOn === fieldId) {
      throw new Error(`Field ${fieldId} in page "${pageId}" cannot depend on itself`);
    }

    const validOperators = ['equals', 'not_equals', 'is_empty', 'is_not_empty', 'contains'];
    if (!validOperators.includes(condition.operator)) {
      throw new Error(`Invalid conditional visibility operator for field ${fieldId}: ${condition.operator}`);
    }

    // Operators that require a value
    const requiresValue = ['equals', 'not_equals', 'contains'];
    if (requiresValue.includes(condition.operator) && condition.value === undefined) {
      throw new Error(`Conditional visibility operator "${condition.operator}" for field ${fieldId} requires a value`);
    }
  }

  /**
   * Validate validation rule configuration
   */
  private static validateValidationRule(
    rule: ValidationRule,
    fieldId: number,
    pageId: string,
    ruleIndex: number
  ): void {
    const validRuleTypes = ['min', 'max', 'pattern', 'min_length', 'max_length', 'email', 'url', 'required'];
    if (!validRuleTypes.includes(rule.type)) {
      throw new Error(`Invalid validation rule type for field ${fieldId}: ${rule.type}`);
    }

    if (!rule.message || rule.message.trim().length === 0) {
      throw new Error(`Validation rule ${ruleIndex} for field ${fieldId} in page "${pageId}" must have an error message`);
    }

    // Rules that require a value
    const requiresValue = ['min', 'max', 'pattern', 'min_length', 'max_length'];
    if (requiresValue.includes(rule.type) && rule.value === undefined) {
      throw new Error(`Validation rule "${rule.type}" for field ${fieldId} requires a value`);
    }

    // Type-specific validation
    if ((rule.type === 'min' || rule.type === 'max') && typeof rule.value !== 'number') {
      throw new Error(`Validation rule "${rule.type}" for field ${fieldId} requires a numeric value`);
    }

    if ((rule.type === 'min_length' || rule.type === 'max_length') && typeof rule.value !== 'number') {
      throw new Error(`Validation rule "${rule.type}" for field ${fieldId} requires a numeric value`);
    }

    if (rule.type === 'pattern' && typeof rule.value !== 'string') {
      throw new Error(`Validation rule "pattern" for field ${fieldId} requires a string value (regex pattern)`);
    }

    // Validate regex pattern is valid
    if (rule.type === 'pattern') {
      try {
        new RegExp(rule.value);
      } catch (e) {
        throw new Error(`Invalid regex pattern in validation rule for field ${fieldId}: ${rule.value}`);
      }
    }
  }
}
