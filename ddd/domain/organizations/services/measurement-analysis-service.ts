// AIDEV-NOTE: Domain service for measurement analysis business logic
// Handles complex business rules for measurement collection and analysis
// Pure domain logic - no infrastructure dependencies

import { AgentId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { 
  MeasurementDefinition, 
  KPIDefinition, 
  OrganizationAnalysisCapabilities 
} from '../entities/organization';

/**
 * Domain service for measurement analysis operations
 * Contains business rules and domain logic for measurements and KPIs
 */
export class MeasurementAnalysisService {

  /**
   * Validate measurement framework configuration
   */
  validateMeasurementFramework(framework: OrganizationAnalysisCapabilities['measurementFramework']): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Business rule: Must have at least one measurement
    if (!framework.measurements || framework.measurements.length === 0) {
      errors.push('Measurement framework must have at least one measurement definition');
    }

    // Business rule: All KPIs must have dependent measurements
    framework.kpiDefinitions.forEach(kpi => {
      const dependentMeasurementsExist = kpi.dependentMeasurements.every(depId =>
        framework.measurements.some(measurement => measurement.id === depId)
      );
      
      if (!dependentMeasurementsExist) {
        errors.push(`KPI "${kpi.name}" references non-existent measurements`);
      }
    });

    // Business rule: All measurements must have assigned agents
    framework.measurements.forEach(measurement => {
      if (!measurement.assignedAgents || measurement.assignedAgents.length === 0) {
        errors.push(`Measurement "${measurement.name}" must have at least one assigned agent`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate measurement collection priority based on business rules
   */
  calculateMeasurementPriority(measurement: MeasurementDefinition): {
    priority: 'critical' | 'high' | 'medium' | 'low';
    reasoning: string;
  } {
    let priorityScore = 0;
    let reasoning = '';

    // High frequency measurements are more critical
    const frequencyWeights = {
      'hourly': 4,
      'daily': 3,
      'weekly': 2,
      'monthly': 1,
      'quarterly': 1
    };
    priorityScore += frequencyWeights[measurement.frequency];

    // Measurements with alert thresholds are more critical
    if (measurement.alertThresholds) {
      priorityScore += 2;
      reasoning += 'Has alert thresholds. ';
    }

    // Financial and efficiency measurements are typically critical
    if (measurement.category === 'financial' || measurement.category === 'efficiency') {
      priorityScore += 3;
      reasoning += `${measurement.category} category is business-critical. `;
    }

    // Quality and satisfaction are high priority
    if (measurement.category === 'quality' || measurement.category === 'satisfaction') {
      priorityScore += 2;
      reasoning += `${measurement.category} impacts customer experience. `;
    }

    // Determine final priority
    let priority: 'critical' | 'high' | 'medium' | 'low';
    if (priorityScore >= 7) {
      priority = 'critical';
    } else if (priorityScore >= 5) {
      priority = 'high';
    } else if (priorityScore >= 3) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    return { priority, reasoning };
  }

  /**
   * Analyze KPI calculation dependencies for scheduling optimization
   */
  analyzeKPICalculationOrder(kpiDefinitions: KPIDefinition[]): {
    calculationOrder: KPIDefinition[];
    dependencyMap: Map<string, string[]>;
    circularDependencies: string[];
  } {
    const dependencyMap = new Map<string, string[]>();
    const circularDependencies: string[] = [];

    // Build dependency map
    kpiDefinitions.forEach(kpi => {
      dependencyMap.set(kpi.id, kpi.dependentMeasurements);
    });

    // Check for circular dependencies (simplified check)
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCircularDependency = (kpiId: string): boolean => {
      if (recursionStack.has(kpiId)) {
        circularDependencies.push(kpiId);
        return true;
      }
      
      if (visited.has(kpiId)) {
        return false;
      }

      visited.add(kpiId);
      recursionStack.add(kpiId);

      const dependencies = dependencyMap.get(kpiId) || [];
      for (const dep of dependencies) {
        // Check if dependency is another KPI
        const dependentKPI = kpiDefinitions.find(k => k.id === dep);
        if (dependentKPI && hasCircularDependency(dep)) {
          return true;
        }
      }

      recursionStack.delete(kpiId);
      return false;
    };

    kpiDefinitions.forEach(kpi => {
      if (!visited.has(kpi.id)) {
        hasCircularDependency(kpi.id);
      }
    });

    // Sort KPIs by dependency complexity (simpler ones first)
    const calculationOrder = [...kpiDefinitions].sort((a, b) => {
      return a.dependentMeasurements.length - b.dependentMeasurements.length;
    });

    return {
      calculationOrder,
      dependencyMap,
      circularDependencies
    };
  }

  /**
   * Generate measurement collection instructions for agents
   */
  generateCollectionInstructions(measurement: MeasurementDefinition): string {
    let instructions = `Collect measurement: ${measurement.name}\n`;
    instructions += `Description: ${measurement.description}\n`;
    instructions += `Category: ${measurement.category}\n`;
    instructions += `Frequency: ${measurement.frequency}\n\n`;

    instructions += `Data Source Configuration:\n`;
    instructions += `- Type: ${measurement.dataSource.type}\n`;
    instructions += `- Location: ${measurement.dataSource.location}\n`;
    instructions += `- Query Instructions: ${measurement.dataSource.queryInstructions}\n\n`;

    if (measurement.validationRules && measurement.validationRules.length > 0) {
      instructions += `Validation Rules:\n`;
      measurement.validationRules.forEach((rule, index) => {
        instructions += `${index + 1}. ${rule}\n`;
      });
      instructions += '\n';
    }

    if (measurement.alertThresholds) {
      instructions += `Alert Thresholds:\n`;
      instructions += `- Warning: ${measurement.alertThresholds.warning}\n`;
      instructions += `- Critical: ${measurement.alertThresholds.critical}\n`;
    }

    if (measurement.targetValue) {
      instructions += `Target Value: ${measurement.targetValue}\n`;
    }

    return instructions;
  }

  /**
   * Validate agent assignment for measurements based on agent capabilities
   */
  validateAgentAssignment(measurement: MeasurementDefinition, agentCapabilities: string[]): {
    canAssign: boolean;
    missingCapabilities: string[];
    recommendations: string[];
  } {
    const requiredCapabilities: string[] = [];
    const recommendations: string[] = [];

    // Map measurement types to required capabilities
    switch (measurement.measurementType) {
      case 'raw_data':
        requiredCapabilities.push('data-collection');
        break;
      case 'calculated_kpi':
        requiredCapabilities.push('mathematical-analysis', 'data-processing');
        break;
      case 'aggregated_metric':
        requiredCapabilities.push('data-aggregation', 'statistical-analysis');
        break;
    }

    // Map data source types to required capabilities
    switch (measurement.dataSource.type) {
      case 'external-api':
        requiredCapabilities.push('api-integration');
        break;
      case 'dynamic-table':
        requiredCapabilities.push('database-access');
        break;
      case 'calculation':
        requiredCapabilities.push('calculation-engine');
        break;
    }

    // Map categories to specialized capabilities
    switch (measurement.category) {
      case 'financial':
        requiredCapabilities.push('financial-analysis');
        recommendations.push('Consider using agents specialized in financial metrics');
        break;
      case 'quality':
        requiredCapabilities.push('quality-assessment');
        break;
    }

    const missingCapabilities = requiredCapabilities.filter(
      capability => !agentCapabilities.includes(capability)
    );

    return {
      canAssign: missingCapabilities.length === 0,
      missingCapabilities,
      recommendations
    };
  }
}