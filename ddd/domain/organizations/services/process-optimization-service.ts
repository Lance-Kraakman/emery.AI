// AIDEV-NOTE: Domain service for process optimization business logic
// Handles complex business rules for process analysis and improvement
// Pure domain logic - no infrastructure dependencies

import { AgentId, TeamId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { 
  ProcessDefinition, 
  ProcessStep, 
  MonitoringPoint,
  ImprovementArea 
} from '../entities/organization';

/**
 * Domain service for process optimization and analysis
 * Contains business rules and domain logic for process improvement
 */
export class ProcessOptimizationService {

  /**
   * Analyze process bottlenecks based on step durations and monitoring data
   */
  identifyProcessBottlenecks(process: ProcessDefinition, performanceData?: {
    stepId: string;
    averageDuration: number;
    completionRate: number;
  }[]): {
    bottlenecks: {
      stepId: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      impact: string;
      recommendations: string[];
    }[];
    overallEfficiency: number;
    criticalPath: string[];
  } {
    const bottlenecks: any[] = [];
    let totalPlannedDuration = 0;
    let totalActualDuration = 0;

    // Calculate planned vs actual performance
    process.processSteps.forEach(step => {
      totalPlannedDuration += step.estimatedDuration;
      
      const performanceInfo = performanceData?.find(p => p.stepId === step.id);
      if (performanceInfo) {
        totalActualDuration += performanceInfo.averageDuration;
        
        // Identify bottlenecks based on duration variance
        const durationVariance = (performanceInfo.averageDuration - step.estimatedDuration) / step.estimatedDuration;
        const completionRateIssue = performanceInfo.completionRate < 0.95;
        
        if (durationVariance > 0.5 || completionRateIssue) {
          let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
          const recommendations: string[] = [];
          
          if (durationVariance > 2 || performanceInfo.completionRate < 0.8) {
            severity = 'critical';
            recommendations.push('Immediate attention required - major process breakdown');
          } else if (durationVariance > 1 || performanceInfo.completionRate < 0.9) {
            severity = 'high';
            recommendations.push('Process redesign recommended');
          } else if (durationVariance > 0.5) {
            severity = 'medium';
            recommendations.push('Process optimization opportunity');
          }

          if (completionRateIssue) {
            recommendations.push('Review quality checks and requirements');
          }

          bottlenecks.push({
            stepId: step.id,
            severity,
            impact: `${Math.round(durationVariance * 100)}% duration increase, ${Math.round(performanceInfo.completionRate * 100)}% completion rate`,
            recommendations
          });
        }
      }
    });

    // Calculate overall efficiency
    const overallEfficiency = totalActualDuration > 0 ? 
      (totalPlannedDuration / totalActualDuration) * 100 : 100;

    // Identify critical path (simplified - longest sequence)
    const criticalPath = process.processSteps
      .sort((a, b) => b.estimatedDuration - a.estimatedDuration)
      .slice(0, Math.ceil(process.processSteps.length * 0.3))
      .map(step => step.id);

    return {
      bottlenecks,
      overallEfficiency: Math.round(overallEfficiency),
      criticalPath
    };
  }

  /**
   * Generate process improvement recommendations based on analysis
   */
  generateImprovementRecommendations(
    process: ProcessDefinition,
    bottlenecks: any[],
    organizationContext: {
      availableTeams: TeamId[];
      budget: 'low' | 'medium' | 'high';
      priority: 'efficiency' | 'quality' | 'cost' | 'speed';
    }
  ): ImprovementArea[] {
    const improvements: ImprovementArea[] = [];

    // Critical bottlenecks become high-priority improvements
    bottlenecks.filter(b => b.severity === 'critical').forEach((bottleneck, index) => {
      const step = process.processSteps.find(s => s.id === bottleneck.stepId);
      if (step) {
        improvements.push({
          id: `${process.id}_critical_${index}`,
          name: `Fix Critical Bottleneck: ${step.name}`,
          description: `Address critical performance issue in ${step.name}. ${bottleneck.impact}`,
          priority: 'critical',
          identifiedDate: new Date().toISOString(),
          status: 'identified',
          assignedTeams: organizationContext.availableTeams.slice(0, 1), // Assign primary team
          estimatedImpact: 'high',
          resourcesRequired: this.calculateRequiredResources(bottleneck.severity, organizationContext.budget),
          targetCompletion: this.calculateTargetCompletion('critical')
        });
      }
    });

    // High severity bottlenecks become medium priority improvements
    bottlenecks.filter(b => b.severity === 'high').forEach((bottleneck, index) => {
      const step = process.processSteps.find(s => s.id === bottleneck.stepId);
      if (step) {
        improvements.push({
          id: `${process.id}_high_${index}`,
          name: `Optimize Process Step: ${step.name}`,
          description: `Optimize performance of ${step.name}. ${bottleneck.impact}`,
          priority: 'high',
          identifiedDate: new Date().toISOString(),
          status: 'identified',
          assignedTeams: organizationContext.availableTeams.slice(0, 1),
          estimatedImpact: 'medium',
          resourcesRequired: this.calculateRequiredResources(bottleneck.severity, organizationContext.budget),
          targetCompletion: this.calculateTargetCompletion('high')
        });
      }
    });

    // Process-wide improvements based on organization priority
    if (organizationContext.priority === 'efficiency') {
      improvements.push({
        id: `${process.id}_efficiency_overall`,
        name: `Overall Process Efficiency Enhancement`,
        description: `Comprehensive review of ${process.name} for efficiency improvements`,
        priority: 'medium',
        identifiedDate: new Date().toISOString(),
        status: 'identified',
        assignedTeams: organizationContext.availableTeams,
        estimatedImpact: 'high',
        resourcesRequired: ['Process analyst', 'Efficiency expert', 'Stakeholder time'],
        targetCompletion: this.calculateTargetCompletion('medium')
      });
    }

    return improvements;
  }

  /**
   * Validate process monitoring configuration
   */
  validateMonitoringSetup(process: ProcessDefinition): {
    isValid: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Business rule: Each critical step should have monitoring
    const criticalSteps = process.processSteps.filter(step => 
      step.estimatedDuration > 60 || // Steps longer than 1 hour
      step.qualityChecks.length > 0   // Steps with quality requirements
    );

    criticalSteps.forEach(step => {
      const hasMonitoring = process.monitoringPoints.some(mp => mp.stepId === step.id);
      if (!hasMonitoring) {
        warnings.push(`Critical step "${step.name}" lacks monitoring configuration`);
        recommendations.push(`Add monitoring point for ${step.name} to track performance`);
      }
    });

    // Business rule: All monitoring points should have assigned agents
    process.monitoringPoints.forEach(point => {
      if (!process.monitoringAgents || process.monitoringAgents.length === 0) {
        warnings.push(`Monitoring point "${point.metricName}" has no assigned agents`);
      }
    });

    // Recommendations based on monitoring frequency
    const realTimePoints = process.monitoringPoints.filter(p => p.frequency === 'real-time');
    if (realTimePoints.length > 3) {
      recommendations.push('Consider consolidating real-time monitoring points to reduce system load');
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      recommendations
    };
  }

  /**
   * Calculate process complexity score for resource allocation
   */
  calculateProcessComplexity(process: ProcessDefinition): {
    complexityScore: number;
    factors: {
      factor: string;
      weight: number;
      reasoning: string;
    }[];
    recommendedAgentCount: number;
  } {
    const factors: any[] = [];
    let complexityScore = 0;

    // Factor: Number of steps
    const stepComplexity = Math.min(process.processSteps.length * 2, 20);
    factors.push({
      factor: 'Step Count',
      weight: stepComplexity,
      reasoning: `${process.processSteps.length} steps contribute ${stepComplexity} complexity points`
    });
    complexityScore += stepComplexity;

    // Factor: Monitoring points
    const monitoringComplexity = process.monitoringPoints.length * 3;
    factors.push({
      factor: 'Monitoring Complexity',
      weight: monitoringComplexity,
      reasoning: `${process.monitoringPoints.length} monitoring points require additional oversight`
    });
    complexityScore += monitoringComplexity;

    // Factor: Quality checks
    const qualityComplexity = process.processSteps.reduce((total, step) => 
      total + step.qualityChecks.length, 0) * 2;
    factors.push({
      factor: 'Quality Requirements',
      weight: qualityComplexity,
      reasoning: 'Quality checks require specialized validation'
    });
    complexityScore += qualityComplexity;

    // Factor: Team coordination
    const teamComplexity = process.assignedTeams.length > 1 ? 
      (process.assignedTeams.length - 1) * 5 : 0;
    if (teamComplexity > 0) {
      factors.push({
        factor: 'Cross-team Coordination',
        weight: teamComplexity,
        reasoning: 'Multiple teams require coordination overhead'
      });
      complexityScore += teamComplexity;
    }

    // Calculate recommended agent count based on complexity
    let recommendedAgentCount = 1; // Minimum one agent
    if (complexityScore > 30) {
      recommendedAgentCount = 3; // High complexity
    } else if (complexityScore > 15) {
      recommendedAgentCount = 2; // Medium complexity
    }

    return {
      complexityScore,
      factors,
      recommendedAgentCount
    };
  }

  private calculateRequiredResources(severity: string, budget: string): string[] {
    const baseResources = ['Process analyst', 'Team lead time'];
    
    if (severity === 'critical') {
      baseResources.push('Senior consultant', 'Executive sponsor');
      if (budget === 'high') {
        baseResources.push('External specialist');
      }
    } else if (severity === 'high') {
      baseResources.push('Process improvement specialist');
    }

    return baseResources;
  }

  private calculateTargetCompletion(priority: string): string {
    const now = new Date();
    let targetDate: Date;

    switch (priority) {
      case 'critical':
        targetDate = new Date(now.getTime() + (2 * 7 * 24 * 60 * 60 * 1000)); // 2 weeks
        break;
      case 'high':
        targetDate = new Date(now.getTime() + (6 * 7 * 24 * 60 * 60 * 1000)); // 6 weeks
        break;
      default:
        targetDate = new Date(now.getTime() + (12 * 7 * 24 * 60 * 60 * 1000)); // 12 weeks
        break;
    }

    return targetDate.toISOString();
  }
}