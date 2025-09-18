// AIDEV-NOTE: CalculationFrequency Value Object - type-safe measurement frequency management
// Encapsulates scheduling and business rules for measurement calculation timing

export const CALCULATION_FREQUENCIES = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  WEEKLY: 'weekly', 
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly'
} as const;

export type CalculationFrequencyType = typeof CALCULATION_FREQUENCIES[keyof typeof CALCULATION_FREQUENCIES];

export class CalculationFrequency {
  private readonly _value: CalculationFrequencyType;

  constructor(value: string) {
    if (!value) {
      throw new Error('Calculation frequency cannot be empty');
    }
    
    if (!this.isValid(value)) {
      throw new Error(`Invalid calculation frequency: ${value}. Must be one of: ${Object.values(CALCULATION_FREQUENCIES).join(', ')}`);
    }
    
    this._value = value as CalculationFrequencyType;
  }

  get value(): string {
    return this._value;
  }

  private isValid(frequency: string): frequency is CalculationFrequencyType {
    return Object.values(CALCULATION_FREQUENCIES).includes(frequency as CalculationFrequencyType);
  }

  static fromString(value: string): CalculationFrequency {
    return new CalculationFrequency(value);
  }

  static hourly(): CalculationFrequency {
    return new CalculationFrequency(CALCULATION_FREQUENCIES.HOURLY);
  }

  static daily(): CalculationFrequency {
    return new CalculationFrequency(CALCULATION_FREQUENCIES.DAILY);
  }

  static weekly(): CalculationFrequency {
    return new CalculationFrequency(CALCULATION_FREQUENCIES.WEEKLY);
  }

  static monthly(): CalculationFrequency {
    return new CalculationFrequency(CALCULATION_FREQUENCIES.MONTHLY);
  }

  static quarterly(): CalculationFrequency {
    return new CalculationFrequency(CALCULATION_FREQUENCIES.QUARTERLY);
  }

  static isValidFrequency(value: string): boolean {
    try {
      new CalculationFrequency(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all available frequencies
   */
  static getAllFrequencies(): CalculationFrequency[] {
    return Object.values(CALCULATION_FREQUENCIES).map(freq => new CalculationFrequency(freq));
  }

  /**
   * Get frequency in minutes
   */
  getIntervalInMinutes(): number {
    switch (this._value) {
      case CALCULATION_FREQUENCIES.HOURLY: return 60;
      case CALCULATION_FREQUENCIES.DAILY: return 60 * 24;
      case CALCULATION_FREQUENCIES.WEEKLY: return 60 * 24 * 7;
      case CALCULATION_FREQUENCIES.MONTHLY: return 60 * 24 * 30; // Approximate
      case CALCULATION_FREQUENCIES.QUARTERLY: return 60 * 24 * 90; // Approximate
      default: return 60 * 24; // Default to daily
    }
  }

  /**
   * Get frequency in milliseconds (for scheduling)
   */
  getIntervalInMilliseconds(): number {
    return this.getIntervalInMinutes() * 60 * 1000;
  }

  /**
   * Get cron expression for scheduling
   */
  getCronExpression(): string {
    switch (this._value) {
      case CALCULATION_FREQUENCIES.HOURLY: return '0 0 * * * *'; // Every hour at minute 0
      case CALCULATION_FREQUENCIES.DAILY: return '0 0 0 * * *';   // Every day at midnight
      case CALCULATION_FREQUENCIES.WEEKLY: return '0 0 0 * * 0';  // Every Sunday at midnight
      case CALCULATION_FREQUENCIES.MONTHLY: return '0 0 0 1 * *'; // First day of month at midnight
      case CALCULATION_FREQUENCIES.QUARTERLY: return '0 0 0 1 */3 *'; // First day of quarter at midnight
      default: return '0 0 0 * * *'; // Default to daily
    }
  }

  /**
   * Get next calculation time from given date
   */
  getNextCalculationTime(fromDate: Date = new Date()): Date {
    const nextTime = new Date(fromDate);
    
    switch (this._value) {
      case CALCULATION_FREQUENCIES.HOURLY:
        nextTime.setHours(nextTime.getHours() + 1, 0, 0, 0);
        break;
      case CALCULATION_FREQUENCIES.DAILY:
        nextTime.setDate(nextTime.getDate() + 1);
        nextTime.setHours(0, 0, 0, 0);
        break;
      case CALCULATION_FREQUENCIES.WEEKLY:
        nextTime.setDate(nextTime.getDate() + (7 - nextTime.getDay()));
        nextTime.setHours(0, 0, 0, 0);
        break;
      case CALCULATION_FREQUENCIES.MONTHLY:
        nextTime.setMonth(nextTime.getMonth() + 1, 1);
        nextTime.setHours(0, 0, 0, 0);
        break;
      case CALCULATION_FREQUENCIES.QUARTERLY:
        const currentQuarter = Math.floor(nextTime.getMonth() / 3);
        nextTime.setMonth((currentQuarter + 1) * 3, 1);
        nextTime.setHours(0, 0, 0, 0);
        break;
    }
    
    return nextTime;
  }

  /**
   * Check if it's time to calculate based on last calculation time
   */
  shouldCalculateNow(lastCalculationTime: Date): boolean {
    const now = new Date();
    const nextCalculationTime = this.getNextCalculationTime(lastCalculationTime);
    return now >= nextCalculationTime;
  }

  /**
   * Get suggested agent count for this frequency
   */
  getSuggestedAgentCount(): number {
    switch (this._value) {
      case CALCULATION_FREQUENCIES.HOURLY: return 2; // High frequency needs redundancy
      case CALCULATION_FREQUENCIES.DAILY: return 1;  // Standard frequency
      case CALCULATION_FREQUENCIES.WEEKLY: return 1; // Low frequency
      case CALCULATION_FREQUENCIES.MONTHLY: return 1; // Very low frequency
      case CALCULATION_FREQUENCIES.QUARTERLY: return 1; // Very low frequency
      default: return 1;
    }
  }

  /**
   * Get frequency priority (higher number = more frequent)
   */
  getPriority(): number {
    switch (this._value) {
      case CALCULATION_FREQUENCIES.HOURLY: return 5;
      case CALCULATION_FREQUENCIES.DAILY: return 4;
      case CALCULATION_FREQUENCIES.WEEKLY: return 3;
      case CALCULATION_FREQUENCIES.MONTHLY: return 2;
      case CALCULATION_FREQUENCIES.QUARTERLY: return 1;
      default: return 0;
    }
  }

  /**
   * Check if this frequency is more frequent than another
   */
  isMoreFrequentThan(other: CalculationFrequency): boolean {
    return this.getPriority() > other.getPriority();
  }

  equals(other: CalculationFrequency): boolean {
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
      case CALCULATION_FREQUENCIES.HOURLY: return 'Hourly';
      case CALCULATION_FREQUENCIES.DAILY: return 'Daily';
      case CALCULATION_FREQUENCIES.WEEKLY: return 'Weekly';
      case CALCULATION_FREQUENCIES.MONTHLY: return 'Monthly';
      case CALCULATION_FREQUENCIES.QUARTERLY: return 'Quarterly';
      default: return this._value;
    }
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    switch (this._value) {
      case CALCULATION_FREQUENCIES.HOURLY: return 'Calculated every hour';
      case CALCULATION_FREQUENCIES.DAILY: return 'Calculated once per day';
      case CALCULATION_FREQUENCIES.WEEKLY: return 'Calculated once per week';
      case CALCULATION_FREQUENCIES.MONTHLY: return 'Calculated once per month';
      case CALCULATION_FREQUENCIES.QUARTERLY: return 'Calculated once per quarter';
      default: return `Calculated ${this._value}`;
    }
  }
}