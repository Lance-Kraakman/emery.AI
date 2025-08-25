// AIDEV-NOTE: Domain service for coordinating organizational analysis
// Handles complex business rules for coordinating measurements, processes, and agents
// Acts as an aggregate root for organizational analysis operations

import { AgentId, TeamId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { OrganizationAnalysisCapabilities } from '../entities/organization';
import { MeasurementAnalysisService } from './measurement-analysis-service';
import { ProcessOptimizationService } from './process-optimization-service';

/**
 * Domain service that coordinates organizational analysis activities
 * Orchestrates measurements, processes, and improvement initiatives
 */
export class AnalysisCoordinationService {
  private measurementService: MeasurementAnalysisService;
  private processService: ProcessOptimizationService;

  constructor() {
    this.measurementService = new MeasurementAnalysisService();
    this.processService = new ProcessOptimizationService();
  }

  /**
   * Validate complete organizational analysis setup
   */
  validateAnalysisCapabilities(capabilities: OrganizationAnalysisCapabilities): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    completenessScore: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let completenessScore = 0;

    // Validate measurement framework (30% of completeness)
    const measurementValidation = this.measurementService.validateMeasurementFramework(
      capabilities.measurementFramework
    );
    
    if (!measurementValidation.isValid) {
      errors.push(...measurementValidation.errors);
    } else {
      completenessScore += 30;
    }

    // Validate process definitions (25% of completeness)
    if (!capabilities.processDefinitions || capabilities.processDefinitions.length === 0) {
      warnings.push('No process definitions configured - process analysis will be limited');
    } else {
      completenessScore += 25;
      
      // Validate each process
      capabilities.processDefinitions.forEach(process => {
        const processValidation = this.processService.validateMonitoringSetup(process);
        if (!processValidation.isValid) {
          warnings.push(`Process "${process.name}": ${processValidation.warnings.join(', ')}`);
        }
      });
    }

    // Validate analysis schedule (20% of completeness)
    if (capabilities.analysisSchedule) {
      completenessScore += 20;
      
      // Business rule: Analysis schedule must have valid timezone
      const validTimezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']; // Simplified
      if (!validTimezones.includes(capabilities.analysisSchedule.timezone)) {
        warnings.push(`Timezone "${capabilities.analysisSchedule.timezone}" may not be supported`);
      }
    } else {
      warnings.push('Analysis schedule not configured - automated analysis may not work');
    }

    // Validate improvement tracking (15% of completeness)
    if (capabilities.improvementTracking && capabilities.improvementTracking.length > 0) {
      completenessScore += 15;
    } else {
      warnings.push('No improvement areas configured - continuous improvement features disabled');
    }

    // Setup completion check (10% of completeness)
    if (capabilities.isSetup) {
      completenessScore += 10;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completenessScore
    };
  }

  /**
   * Generate comprehensive analysis execution plan
   */
  generateAnalysisExecutionPlan(
    organizationId: OrganizationId,
    capabilities: OrganizationAnalysisCapabilities,
    availableAgents: {
      id: AgentId;
      type: string;
      capabilities: string[];
    }[]
  ): {
    executionPlan: {
      phase: string;
      priority: number;
      tasks: {
        type: 'measurement' | 'process' | 'analysis' | 'reporting';
        description: string;
        assignedAgent: AgentId;
        estimatedDuration: number;
        dependencies: string[];
      }[];
      estimatedCompletion: string;
    }[];
    resourceRequirements: {
      requiredAgentTypes: string[];
      recommendedTeamSize: number;
      estimatedTimeframe: string;
    };
    riskAssessment: {
      risks: string[];
      mitigations: string[];
    };
  } {
    const executionPlan: any[] = [];
    const requiredAgentTypes = new Set<string>();
    const risks: string[] = [];
    const mitigations: string[] = [];

    // Phase 1: Data Collection Setup (Priority 1)
    const dataCollectionTasks: any[] = [];
    
    capabilities.measurementFramework.measurements.forEach(measurement => {
      // Find suitable agent for this measurement
      const suitableAgent = this.findSuitableAgent(availableAgents, ['data-collection']);
      if (suitableAgent) {
        dataCollectionTasks.push({
          type: 'measurement',
          description: `Set up data collection for ${measurement.name}`,
          assignedAgent: suitableAgent.id,
          estimatedDuration: this.estimateTaskDuration(measurement),
          dependencies: []
        });
        requiredAgentTypes.add('data-collector');
      } else {
        risks.push(`No suitable agent found for measurement: ${measurement.name}`);
        mitigations.push(`Consider creating or acquiring data-collector agents`);
      }
    });

    if (dataCollectionTasks.length > 0) {
      executionPlan.push({
        phase: 'Data Collection Setup',
        priority: 1,
        tasks: dataCollectionTasks,
        estimatedCompletion: this.calculatePhaseCompletion(dataCollectionTasks)
      });
    }

    // Phase 2: Process Monitoring Setup (Priority 2)
    const processMonitoringTasks: any[] = [];
    
    capabilities.processDefinitions.forEach(process => {
      const processComplexity = this.processService.calculateProcessComplexity(process);
      const suitableAgent = this.findSuitableAgent(availableAgents, ['process-analysis']);
      
      if (suitableAgent) {
        processMonitoringTasks.push({
          type: 'process',
          description: `Configure monitoring for process: ${process.name}`,
          assignedAgent: suitableAgent.id,
          estimatedDuration: processComplexity.complexityScore * 2, // 2 minutes per complexity point
          dependencies: ['Data Collection Setup'] // Depends on data collection
        });
        requiredAgentTypes.add('process-analyst');
      } else {
        risks.push(`No process analyst available for: ${process.name}`);
      }
    });

    if (processMonitoringTasks.length > 0) {
      executionPlan.push({
        phase: 'Process Monitoring Setup',
        priority: 2,
        tasks: processMonitoringTasks,
        estimatedCompletion: this.calculatePhaseCompletion(processMonitoringTasks)
      });
    }

    // Phase 3: KPI Calculation Setup (Priority 3)
    const kpiCalculationTasks: any[] = [];
    
    const kpiAnalysis = this.measurementService.analyzeKPICalculationOrder(
      capabilities.measurementFramework.kpiDefinitions
    );

    if (kpiAnalysis.circularDependencies.length > 0) {
      risks.push(`Circular dependencies detected in KPI calculations: ${kpiAnalysis.circularDependencies.join(', ')}`);
      mitigations.push('Review and redesign KPI dependencies to eliminate circular references');
    }

    kpiAnalysis.calculationOrder.forEach(kpi => {
      const suitableAgent = this.findSuitableAgent(availableAgents, ['mathematical-analysis']);
      if (suitableAgent) {
        kpiCalculationTasks.push({
          type: 'analysis',
          description: `Configure KPI calculation for ${kpi.name}`,
          assignedAgent: suitableAgent.id,
          estimatedDuration: 30, // 30 minutes per KPI
          dependencies: ['Data Collection Setup'] // KPIs depend on measurements
        });
        requiredAgentTypes.add('kpi-calculator');
      }
    });

    if (kpiCalculationTasks.length > 0) {
      executionPlan.push({
        phase: 'KPI Calculation Setup',
        priority: 3,
        tasks: kpiCalculationTasks,
        estimatedCompletion: this.calculatePhaseCompletion(kpiCalculationTasks)
      });
    }

    // Calculate resource requirements
    const recommendedTeamSize = Math.max(3, Math.ceil(requiredAgentTypes.size * 1.5));
    const totalTasks = executionPlan.reduce((sum, phase) => sum + phase.tasks.length, 0);
    const estimatedHours = Math.ceil(totalTasks * 0.75); // Average 45 minutes per task

    return {
      executionPlan,
      resourceRequirements: {
        requiredAgentTypes: Array.from(requiredAgentTypes),
        recommendedTeamSize,
        estimatedTimeframe: `${estimatedHours} hours (${Math.ceil(estimatedHours / 8)} business days)`
      },
      riskAssessment: {
        risks,
        mitigations
      }
    };
  }

  /**
   * Coordinate measurement and process optimization activities
   */
  coordinateOptimizationActivities(
    measurements: any[],
    processes: any[],
    performanceData: any[]
  ): {
    prioritizedActions: {
      action: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
      estimatedImpact: string;
      requiredAgents: AgentId[];
      timeline: string;
    }[];
    resourceAllocation: {
      agentType: string;
      workloadPercentage: number;
      responsibilities: string[];
    }[];
  } {
    const prioritizedActions: any[] = [];
    const resourceAllocation: any[] = [];

    // Analyze measurement priorities
    measurements.forEach(measurement => {
      const priority = this.measurementService.calculateMeasurementPriority(measurement);
      if (priority.priority === 'critical' || priority.priority === 'high') {
        prioritizedActions.push({
          action: `Optimize measurement collection: ${measurement.name}`,
          priority: priority.priority,
          estimatedImpact: priority.reasoning,
          requiredAgents: measurement.assignedAgents,
          timeline: priority.priority === 'critical' ? 'Immediate' : 'Within 1 week'
        });
      }
    });

    // Analyze process bottlenecks
    processes.forEach(process => {
      const processPerformance = performanceData.filter(p => p.processId === process.id);
      const bottleneckAnalysis = this.processService.identifyProcessBottlenecks(process, processPerformance);
      
      bottleneckAnalysis.bottlenecks.forEach(bottleneck => {
        if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
          prioritizedActions.push({
            action: `Address process bottleneck: ${process.name}`,
            priority: bottleneck.severity,
            estimatedImpact: bottleneck.impact,
            requiredAgents: process.monitoringAgents,
            timeline: bottleneck.severity === 'critical' ? 'Immediate' : 'Within 2 weeks'
          });
        }
      });
    });

    // Sort actions by priority
    prioritizedActions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Calculate resource allocation
    const agentWorkloads = new Map<string, { percentage: number; responsibilities: Set<string> }>();
    
    prioritizedActions.forEach(action => {
      action.requiredAgents.forEach((agentId: AgentId) => {
        const agentIdStr = agentId.value.toString();
        if (!agentWorkloads.has(agentIdStr)) {
          agentWorkloads.set(agentIdStr, { percentage: 0, responsibilities: new Set() });
        }
        
        const workload = agentWorkloads.get(agentIdStr)!;
        workload.percentage += action.priority === 'critical' ? 30 : 
                              action.priority === 'high' ? 20 : 10;
        workload.responsibilities.add(action.action);
      });
    });

    agentWorkloads.forEach((workload, agentId) => {
      resourceAllocation.push({
        agentType: `Agent-${agentId}`,
        workloadPercentage: Math.min(100, workload.percentage),
        responsibilities: Array.from(workload.responsibilities)
      });
    });

    return {
      prioritizedActions,
      resourceAllocation
    };
  }

  private findSuitableAgent(
    availableAgents: { id: AgentId; type: string; capabilities: string[] }[],
    requiredCapabilities: string[]
  ): { id: AgentId; type: string; capabilities: string[] } | null {
    return availableAgents.find(agent => 
      requiredCapabilities.some(required => 
        agent.capabilities.includes(required)
      )
    ) || null;
  }

  private estimateTaskDuration(measurement: any): number {
    // Estimate in minutes based on measurement complexity
    let duration = 20; // Base duration
    
    if (measurement.dataSource.type === 'external-api') {
      duration += 30; // API integration complexity
    }
    
    if (measurement.validationRules?.length > 0) {
      duration += measurement.validationRules.length * 5; // 5 minutes per validation rule
    }
    
    return duration;
  }

  private calculatePhaseCompletion(tasks: any[]): string {
    const totalDuration = tasks.reduce((sum, task) => sum + task.estimatedDuration, 0);
    const daysRequired = Math.ceil(totalDuration / (8 * 60)); // Convert minutes to days
    
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + daysRequired);
    
    return completionDate.toISOString().split('T')[0]; // Return just the date part
  }
}