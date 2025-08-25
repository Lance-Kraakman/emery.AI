// AIDEV-NOTE: Simplified measurement analysis service
// Most measurement logic is handled by specialized agents (data-collector, kpi-calculator)
// This service only contains essential validation that can't be delegated

import { AgentId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { OrganizationAnalysisCapabilities } from '../entities/organization';

/**
 * Simplified domain service for measurement analysis
 * Most complex analysis is delegated to specialized agents
 */
export class MeasurementAnalysisService {

  /**
   * Basic validation of analysis capabilities configuration
   */
  validateAnalysisCapabilities(capabilities?: OrganizationAnalysisCapabilities | null): {
    isValid: boolean;
    errors: string[];
  } {
    if (!capabilities) {
      return { isValid: true, errors: [] }; // Analysis capabilities are optional
    }

    const errors: string[] = [];

    // Basic structural validation only
    if (typeof capabilities.isSetup !== 'boolean') {
      errors.push('Analysis capabilities must have isSetup boolean field');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate basic collection instructions for agents
   * Most detailed instruction generation happens in the agents themselves
   */
  generateBasicInstructions(measurementName: string, description?: string): string {
    return `Collect measurement: ${measurementName}${description ? `\nDescription: ${description}` : ''}`;
  }
}