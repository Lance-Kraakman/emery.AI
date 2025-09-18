// AIDEV-NOTE: MeasurementCategory Value Object - type-safe organizational measurement categories
// Encapsulates business measurement classification and validation logic

export const MEASUREMENT_CATEGORIES = {
  EFFICIENCY: 'efficiency',
  QUALITY: 'quality',
  SATISFACTION: 'satisfaction', 
  FINANCIAL: 'financial',
  PERFORMANCE: 'performance'
} as const;

export type MeasurementCategoryType = typeof MEASUREMENT_CATEGORIES[keyof typeof MEASUREMENT_CATEGORIES];

export class MeasurementCategory {
  private readonly _value: MeasurementCategoryType;

  constructor(value: string) {
    if (!value) {
      throw new Error('Measurement category cannot be empty');
    }
    
    if (!this.isValid(value)) {
      throw new Error(`Invalid measurement category: ${value}. Must be one of: ${Object.values(MEASUREMENT_CATEGORIES).join(', ')}`);
    }
    
    this._value = value as MeasurementCategoryType;
  }

  get value(): string {
    return this._value;
  }

  private isValid(category: string): category is MeasurementCategoryType {
    return Object.values(MEASUREMENT_CATEGORIES).includes(category as MeasurementCategoryType);
  }

  static fromString(value: string): MeasurementCategory {
    return new MeasurementCategory(value);
  }

  static efficiency(): MeasurementCategory {
    return new MeasurementCategory(MEASUREMENT_CATEGORIES.EFFICIENCY);
  }

  static quality(): MeasurementCategory {
    return new MeasurementCategory(MEASUREMENT_CATEGORIES.QUALITY);
  }

  static satisfaction(): MeasurementCategory {
    return new MeasurementCategory(MEASUREMENT_CATEGORIES.SATISFACTION);
  }

  static financial(): MeasurementCategory {
    return new MeasurementCategory(MEASUREMENT_CATEGORIES.FINANCIAL);
  }

  static performance(): MeasurementCategory {
    return new MeasurementCategory(MEASUREMENT_CATEGORIES.PERFORMANCE);
  }

  static isValidCategory(value: string): boolean {
    try {
      new MeasurementCategory(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all available categories
   */
  static getAllCategories(): MeasurementCategory[] {
    return Object.values(MEASUREMENT_CATEGORIES).map(category => new MeasurementCategory(category));
  }

  /**
   * Get typical measurement types for this category
   */
  getTypicalMeasurements(): string[] {
    switch (this._value) {
      case MEASUREMENT_CATEGORIES.EFFICIENCY:
        return ['Processing Time', 'Resource Utilization', 'Throughput', 'Cycle Time', 'Automation Rate'];
      case MEASUREMENT_CATEGORIES.QUALITY:
        return ['Error Rate', 'Defect Density', 'Accuracy Score', 'Compliance Rate', 'Review Score'];
      case MEASUREMENT_CATEGORIES.SATISFACTION:
        return ['Customer Satisfaction', 'Employee Satisfaction', 'Net Promoter Score', 'Retention Rate'];
      case MEASUREMENT_CATEGORIES.FINANCIAL:
        return ['Cost per Unit', 'Revenue Growth', 'Profit Margin', 'ROI', 'Budget Variance'];
      case MEASUREMENT_CATEGORIES.PERFORMANCE:
        return ['Response Time', 'Availability', 'Scalability', 'Reliability', 'Capacity'];
      default:
        return [];
    }
  }

  /**
   * Get suggested KPIs for this category
   */
  getSuggestedKPIs(): string[] {
    switch (this._value) {
      case MEASUREMENT_CATEGORIES.EFFICIENCY:
        return ['Average Processing Time', 'Resource Efficiency Ratio', 'Process Automation %'];
      case MEASUREMENT_CATEGORIES.QUALITY:
        return ['Quality Score', 'First-Time Right Rate', 'Customer Issue Resolution Time'];
      case MEASUREMENT_CATEGORIES.SATISFACTION:
        return ['Customer Satisfaction Index', 'Employee Net Promoter Score', 'Retention Rate'];
      case MEASUREMENT_CATEGORIES.FINANCIAL:
        return ['Cost Savings', 'Revenue per Employee', 'Process Cost Efficiency'];
      case MEASUREMENT_CATEGORIES.PERFORMANCE:
        return ['System Uptime', 'Performance Index', 'Scalability Factor'];
      default:
        return [];
    }
  }

  /**
   * Get typical measurement units for this category
   */
  getTypicalUnits(): string[] {
    switch (this._value) {
      case MEASUREMENT_CATEGORIES.EFFICIENCY:
        return ['minutes', 'hours', 'percentage', 'ratio', 'count per hour'];
      case MEASUREMENT_CATEGORIES.QUALITY:
        return ['percentage', 'score', 'ratio', 'count', 'errors per unit'];
      case MEASUREMENT_CATEGORIES.SATISFACTION:
        return ['score', 'percentage', 'rating', 'index'];
      case MEASUREMENT_CATEGORIES.FINANCIAL:
        return ['currency', 'percentage', 'ratio', 'cost per unit'];
      case MEASUREMENT_CATEGORIES.PERFORMANCE:
        return ['milliseconds', 'percentage', 'throughput', 'capacity'];
      default:
        return ['count', 'percentage', 'score'];
    }
  }

  /**
   * Get category color for UI display
   */
  getColor(): string {
    switch (this._value) {
      case MEASUREMENT_CATEGORIES.EFFICIENCY: return '#10b981'; // Green
      case MEASUREMENT_CATEGORIES.QUALITY: return '#3b82f6';    // Blue
      case MEASUREMENT_CATEGORIES.SATISFACTION: return '#f59e0b'; // Amber
      case MEASUREMENT_CATEGORIES.FINANCIAL: return '#8b5cf6';   // Purple
      case MEASUREMENT_CATEGORIES.PERFORMANCE: return '#ef4444'; // Red
      default: return '#6b7280'; // Gray
    }
  }

  equals(other: MeasurementCategory): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  /**
   * Get display name for UI
   */
  getDisplayName(): string {
    switch (this._value) {
      case MEASUREMENT_CATEGORIES.EFFICIENCY: return 'Efficiency';
      case MEASUREMENT_CATEGORIES.QUALITY: return 'Quality';
      case MEASUREMENT_CATEGORIES.SATISFACTION: return 'Satisfaction';
      case MEASUREMENT_CATEGORIES.FINANCIAL: return 'Financial';
      case MEASUREMENT_CATEGORIES.PERFORMANCE: return 'Performance';
      default: return this._value;
    }
  }

  /**
   * Get icon for UI display
   */
  getIcon(): string {
    switch (this._value) {
      case MEASUREMENT_CATEGORIES.EFFICIENCY: return 'clock';
      case MEASUREMENT_CATEGORIES.QUALITY: return 'shield-check';
      case MEASUREMENT_CATEGORIES.SATISFACTION: return 'heart';
      case MEASUREMENT_CATEGORIES.FINANCIAL: return 'currency-dollar';
      case MEASUREMENT_CATEGORIES.PERFORMANCE: return 'chart-bar';
      default: return 'chart-pie';
    }
  }
}