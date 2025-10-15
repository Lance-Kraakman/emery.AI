// Agent Type Configurations for Organizational Analysis
// Defines default tools, capabilities, and specializations for each agent type

import type { AgentType, AgentSpecialization } from '@/ddd/domain/agents/entities/agent';

export interface AgentTypeConfig {
  defaultTools: string[];
  recommendedCapabilities: string[];
  description: string;
  specializations: string[];
  defaultSpecialization: AgentSpecialization;
}

export const AGENT_TYPE_CONFIGS: Record<AgentType, AgentTypeConfig> = {
  'general': {
    defaultTools: ['emery_database', 'table_data'],
    recommendedCapabilities: ['general-assistance', 'basic-analysis'],
    description: 'General-purpose agent capable of various organizational tasks',
    specializations: ['multi-purpose', 'flexible-workflows'],
    defaultSpecialization: {
      domainExpertise: ['general-business', 'data-access']
    }
  },

  'data-collector': {
    defaultTools: ['emery_database', 'table_data', 'measurement_api'],
    recommendedCapabilities: ['data-collection', 'validation', 'storage'],
    description: 'Specialized in collecting raw data from various sources and storing in measurement tables',
    specializations: ['survey-collection', 'api-integration', 'file-processing', 'real-time-monitoring'],
    defaultSpecialization: {
      measurementCategories: ['efficiency', 'quality', 'satisfaction', 'financial', 'performance'],
      analysisCapabilities: ['data-validation', 'data-cleansing', 'source-integration'],
      domainExpertise: ['data-sources', 'measurement-systems', 'quality-assurance']
    }
  },

  'kpi-calculator': {
    defaultTools: ['emery_database', 'table_data', 'measurement_api'],
    recommendedCapabilities: ['calculation', 'aggregation', 'trend-analysis'],
    description: 'Specialized in calculating KPIs from raw measurement data using complex formulas',
    specializations: ['financial-metrics', 'performance-metrics', 'satisfaction-scores', 'efficiency-ratios'],
    defaultSpecialization: {
      calculationTypes: ['averages', 'ratios', 'percentages', 'trends', 'forecasts'],
      analysisCapabilities: ['mathematical-analysis', 'statistical-processing', 'trend-identification'],
      domainExpertise: ['statistics', 'business-metrics', 'performance-indicators']
    }
  },

  'process-analyst': {
    defaultTools: ['emery_database', 'table_data', 'process_api', 'measurement_api'],
    recommendedCapabilities: ['process-analysis', 'bottleneck-detection', 'optimization'],
    description: 'Specialized in analyzing organizational processes and identifying improvement opportunities',
    specializations: ['workflow-analysis', 'resource-optimization', 'quality-improvement', 'automation-opportunities'],
    defaultSpecialization: {
      analysisCapabilities: ['process-mapping', 'bottleneck-analysis', 'efficiency-optimization', 'workflow-design'],
      domainExpertise: ['process-improvement', 'lean-methodologies', 'workflow-optimization', 'resource-management']
    }
  },

  'reporter': {
    defaultTools: ['emery_database', 'table_data', 'measurement_api'],
    recommendedCapabilities: ['report-generation', 'visualization', 'executive-summaries'],
    description: 'Specialized in generating reports and insights from measurement and process data',
    specializations: ['executive-dashboards', 'trend-reports', 'performance-summaries', 'alert-notifications'],
    defaultSpecialization: {
      analysisCapabilities: ['data-visualization', 'narrative-generation', 'insight-synthesis', 'trend-reporting'],
      domainExpertise: ['business-intelligence', 'data-storytelling', 'executive-communication', 'dashboard-design']
    }
  },

  'coordinator': {
    defaultTools: ['measurement_api', 'process_api'],
    recommendedCapabilities: ['workflow-coordination', 'agent-management', 'escalation'],
    description: 'Specialized in coordinating activities between other agents and managing complex workflows',
    specializations: ['multi-agent-workflows', 'dependency-management', 'error-handling', 'performance-monitoring'],
    defaultSpecialization: {
      analysisCapabilities: ['workflow-orchestration', 'dependency-analysis', 'resource-coordination', 'exception-handling'],
      domainExpertise: ['project-management', 'workflow-coordination', 'system-integration', 'process-optimization']
    }
  },

  'monitor': {
    defaultTools: ['emery_database', 'table_data', 'measurement_api'],
    recommendedCapabilities: ['real-time-monitoring', 'alerting', 'anomaly-detection'],
    description: 'Specialized in real-time monitoring and alerting for critical organizational metrics',
    specializations: ['threshold-monitoring', 'anomaly-detection', 'escalation-management', 'real-time-dashboards'],
    defaultSpecialization: {
      analysisCapabilities: ['real-time-analysis', 'anomaly-detection', 'threshold-monitoring', 'alert-generation'],
      domainExpertise: ['monitoring-systems', 'alert-management', 'anomaly-detection', 'real-time-analytics']
    }
  }
};

// Helper functions for working with agent type configurations
export const getAgentTypeConfig = (agentType: AgentType): AgentTypeConfig => {
  return AGENT_TYPE_CONFIGS[agentType];
};

export const getDefaultToolsForType = (agentType: AgentType): string[] => {
  return AGENT_TYPE_CONFIGS[agentType].defaultTools;
};

export const getRecommendedCapabilitiesForType = (agentType: AgentType): string[] => {
  return AGENT_TYPE_CONFIGS[agentType].recommendedCapabilities;
};

export const getDefaultSpecializationForType = (agentType: AgentType): AgentSpecialization => {
  return AGENT_TYPE_CONFIGS[agentType].defaultSpecialization;
};

// Function to determine the best agent type for a given set of requirements
export const suggestAgentType = (requirements: {
  primaryFunction?: string;
  dataTypes?: string[];
  analysisNeeds?: string[];
  realTimeNeeds?: boolean;
}): AgentType => {
  const { primaryFunction, dataTypes, analysisNeeds, realTimeNeeds } = requirements;

  // Real-time requirements
  if (realTimeNeeds) {
    return 'monitor';
  }

  // Function-based suggestions
  switch (primaryFunction) {
    case 'data-collection':
    case 'data-gathering':
      return 'data-collector';
    
    case 'kpi-calculation':
    case 'metric-calculation':
      return 'kpi-calculator';
    
    case 'process-analysis':
    case 'workflow-analysis':
      return 'process-analyst';
    
    case 'reporting':
    case 'dashboard':
      return 'reporter';
    
    case 'coordination':
    case 'orchestration':
      return 'coordinator';
    
    case 'monitoring':
    case 'alerting':
      return 'monitor';
    
    default:
      return 'general';
  }
};

// Function to merge tools for an agent based on type and existing tools
export const mergeToolsForType = (
  existingTools: string[],
  agentType: AgentType,
  organizationId?: number
): Array<{ name: string; config?: Record<string, any> }> => {
  const typeConfig = getAgentTypeConfig(agentType);
  const existingToolNames = existingTools;
  const newTools: Array<{ name: string; config?: Record<string, any> }> = [];

  // Add existing tools first
  existingToolNames.forEach(toolName => {
    newTools.push({ name: toolName });
  });

  // Add default tools for the type if not already present
  typeConfig.defaultTools.forEach(toolName => {
    if (!existingToolNames.includes(toolName)) {
      const toolConfig: { name: string; config?: Record<string, any> } = { name: toolName };
      
      // Add organization-specific config for certain tools
      if (toolName === 'measurement_api' || toolName === 'process_api') {
        toolConfig.config = { organization_id: organizationId };
      }
      
      newTools.push(toolConfig);
    }
  });

  return newTools;
};