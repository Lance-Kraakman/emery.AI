// AIDEV-NOTE: Type-safe RBAC permission system with granular actions and resources
// Replaces hardcoded role system with flexible permission-based access control

export const ACTIONS = {
  VIEW: 'view',
  MANAGE: 'manage', 
  CREATE: 'create',
  EXECUTE: 'execute',
  INVITE: 'invite'
} as const;

export const RESOURCES = {
  ORGANIZATIONS: 'organizations',
  USERS: 'users',
  TEAMS: 'teams', 
  AGENTS: 'agents',
  TASKS: 'tasks',
  DATA: 'data'
} as const;

export type ActionType = typeof ACTIONS[keyof typeof ACTIONS];
export type ResourceType = typeof RESOURCES[keyof typeof RESOURCES];

export class Permission {
  constructor(
    public readonly resource: ResourceType,
    public readonly action: ActionType
  ) {}
  
  toString(): string { 
    return `${this.resource}:${this.action}`;
  }
  
  equals(other: Permission): boolean {
    return this.resource === other.resource && this.action === other.action;
  }

  // Static factory methods for common permissions
  static readonly ORGANIZATIONS_VIEW = new Permission(RESOURCES.ORGANIZATIONS, ACTIONS.VIEW);
  static readonly ORGANIZATIONS_MANAGE = new Permission(RESOURCES.ORGANIZATIONS, ACTIONS.MANAGE);
  
  static readonly USERS_VIEW = new Permission(RESOURCES.USERS, ACTIONS.VIEW);
  static readonly USERS_MANAGE = new Permission(RESOURCES.USERS, ACTIONS.MANAGE);
  static readonly USERS_INVITE = new Permission(RESOURCES.USERS, ACTIONS.INVITE);
  
  static readonly TEAMS_VIEW = new Permission(RESOURCES.TEAMS, ACTIONS.VIEW);
  static readonly TEAMS_MANAGE = new Permission(RESOURCES.TEAMS, ACTIONS.MANAGE);
  static readonly TEAMS_CREATE = new Permission(RESOURCES.TEAMS, ACTIONS.CREATE);
  
  static readonly AGENTS_VIEW = new Permission(RESOURCES.AGENTS, ACTIONS.VIEW);
  static readonly AGENTS_MANAGE = new Permission(RESOURCES.AGENTS, ACTIONS.MANAGE);
  static readonly AGENTS_CREATE = new Permission(RESOURCES.AGENTS, ACTIONS.CREATE);
  static readonly AGENTS_EXECUTE = new Permission(RESOURCES.AGENTS, ACTIONS.EXECUTE);
  
  static readonly TASKS_VIEW = new Permission(RESOURCES.TASKS, ACTIONS.VIEW);
  static readonly TASKS_MANAGE = new Permission(RESOURCES.TASKS, ACTIONS.MANAGE);
  static readonly TASKS_CREATE = new Permission(RESOURCES.TASKS, ACTIONS.CREATE);
  static readonly TASKS_EXECUTE = new Permission(RESOURCES.TASKS, ACTIONS.EXECUTE);
  
  static readonly DATA_VIEW = new Permission(RESOURCES.DATA, ACTIONS.VIEW);
  static readonly DATA_MANAGE = new Permission(RESOURCES.DATA, ACTIONS.MANAGE);
  static readonly DATA_CREATE = new Permission(RESOURCES.DATA, ACTIONS.CREATE);

  // Helper method to get all permissions for a resource
  static getAllForResource(resource: ResourceType): Permission[] {
    return Object.values(ACTIONS).map(action => new Permission(resource, action));
  }

  // Helper method to get all permissions
  static getAll(): Permission[] {
    const permissions: Permission[] = [];
    for (const resource of Object.values(RESOURCES)) {
      for (const action of Object.values(ACTIONS)) {
        permissions.push(new Permission(resource, action));
      }
    }
    return permissions;
  }

  // Create permission from string (for database queries)
  static fromString(permissionString: string): Permission {
    const [resource, action] = permissionString.split(':');
    if (!resource || !action) {
      throw new Error(`Invalid permission string: ${permissionString}`);
    }
    if (!Object.values(RESOURCES).includes(resource as ResourceType)) {
      throw new Error(`Invalid resource: ${resource}`);
    }
    if (!Object.values(ACTIONS).includes(action as ActionType)) {
      throw new Error(`Invalid action: ${action}`);
    }
    return new Permission(resource as ResourceType, action as ActionType);
  }
}

// Helper type for permission checking in application code
export type PermissionCheck = Permission | string;

// Helper function to normalize permission for checking
export function normalizePermission(permission: PermissionCheck): Permission {
  if (typeof permission === 'string') {
    return Permission.fromString(permission);
  }
  return permission;
}