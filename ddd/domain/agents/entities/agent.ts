// AIDEV-NOTE: Agent domain entity
// Represents an AI agent with capabilities, tools, and trigger configuration

export interface AgentConfig {
  name: string;
  role?: string | null;
  description?: string | null;
  persona?: string | null;
  tools?: Record<string, any> | null;
  servers?: Record<string, any> | null;
  trigger?: Record<string, any> | null;
  capabilities?: Record<string, any> | null;
  databaseId?: string | null;
  status?: string | null;
  organizationId: number;
  ownerId: string;
  roleId?: number | null;
  apiKey?: string | null;
}

export class Agent {
  private constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly role: string | null,
    public readonly description: string | null,
    public readonly persona: string | null,
    public readonly tools: Record<string, any> | null,
    public readonly servers: Record<string, any> | null,
    public readonly trigger: Record<string, any> | null,
    public readonly capabilities: Record<string, any> | null,
    public readonly databaseId: string | null,
    public readonly status: string | null,
    public readonly organizationId: number,
    public readonly ownerId: string,
    public readonly roleId: number | null,
    public readonly apiKey: string | null,
    public readonly createdAt?: Date | null
  ) {}

  static create(config: AgentConfig): Agent {
    return new Agent(
      0, // Will be set by repository
      config.name,
      config.role || null,
      config.description || null,
      config.persona || null,
      config.tools || null,
      config.servers || null,
      config.trigger || null,
      config.capabilities || null,
      config.databaseId || null,
      config.status || 'active',
      config.organizationId,
      config.ownerId,
      config.roleId || null,
      config.apiKey || null
    );
  }

  static fromPersistence(data: {
    id: number;
    name: string;
    role?: string | null;
    description?: string | null;
    persona?: string | null;
    tools?: Record<string, any> | null;
    servers?: Record<string, any> | null;
    trigger?: Record<string, any> | null;
    capabilities?: Record<string, any> | null;
    databaseId?: string | null;
    status?: string | null;
    organizationId: number;
    ownerId: string;
    roleId?: number | null;
    apiKey?: string | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
  }): Agent {
    return new Agent(
      data.id,
      data.name,
      data.role || null,
      data.description || null,
      data.persona || null,
      data.tools || null,
      data.servers || null,
      data.trigger || null,
      data.capabilities || null,
      data.databaseId || null,
      data.status || null,
      data.organizationId,
      data.ownerId,
      data.roleId || null,
      data.apiKey || null,
      data.createdAt || null
    );
  }

  /**
   * Get agent's display name with role if available
   */
  get displayName(): string {
    return this.role ? `${this.name} (${this.role})` : this.name;
  }

  /**
   * Check if agent is active
   */
  get isActive(): boolean {
    return this.status !== 'inactive' && this.status !== 'disabled';
  }

  /**
   * Get agent capabilities count
   */
  get capabilitiesCount(): number {
    if (!this.capabilities || typeof this.capabilities !== 'object') {
      return 0;
    }
    return Array.isArray(this.capabilities) ? this.capabilities.length : Object.keys(this.capabilities).length;
  }
}