'use server'

import { revalidatePath } from "next/cache";
import { getRoleRepository } from "@/ddd/application/di/container";
import { requireCurrentOrganization } from "./user-organizations";
import type { Result } from "./types";
import type { CreateRoleData, UpdateRoleData } from "./types";

export async function createRole(data: CreateRoleData): Promise<Result> {
  try {
    const { name, permissions, organizationId } = data;

    if (!name || !permissions || permissions.length === 0) {
      return {
        success: false,
        error: "Role name and permissions are required",
      };
    }

    if (!organizationId) {
      return {
        success: false,
        error: "Organization ID is required",
      };
    }

    const roleRepository = getRoleRepository();
    const newRole = await roleRepository.create(data);

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: newRole,
    };
  } catch (error) {
    console.error("Error creating role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create role",
    };
  }
}

export async function createRoleAction(formData: FormData) {
  const currentOrg = await requireCurrentOrganization();
  const name = formData.get('name') as string;
  const permissionsStr = formData.get('permissions') as string;
  
  const permissions = permissionsStr ? permissionsStr.split(',').map(p => p.trim()) : [];

  const result = await createRole({ name, permissions, organizationId: currentOrg.id.value });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/dashboard');
  return result;
}

export async function getRoles(organizationId?: number) {
  try {
    const roleRepository = getRoleRepository();
    
    if (organizationId) {
      return await roleRepository.findByOrganization(organizationId);
    } else {
      // For backward compatibility, we need an organization ID
      // In a real app, this would come from the user's session
      throw new Error("Organization ID is required to fetch roles");
    }
  } catch (error) {
    console.error("Error fetching roles:", error);
    throw new Error("Failed to fetch roles");
  }
}

export async function getRole(roleId: number) {
  try {
    if (!roleId) {
      throw new Error("roleId is required");
    }

    const roleRepository = getRoleRepository();
    const role = await roleRepository.findById(roleId);

    if (!role) {
      throw new Error(`Role with id ${roleId} not found`);
    }

    return role;
  } catch (error) {
    console.error("Error fetching role:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to fetch role");
  }
}

export async function updateRole(roleId: number, data: UpdateRoleData): Promise<Result> {
  try {
    if (!roleId) {
      return {
        success: false,
        error: "roleId is required",
      };
    }

    const roleRepository = getRoleRepository();
    const updatedRole = await roleRepository.update(roleId, data);

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: updatedRole,
    };
  } catch (error) {
    console.error("Error updating role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update role",
    };
  }
}

export async function deleteRole(roleId: number): Promise<Result> {
  try {
    if (!roleId) {
      return {
        success: false,
        error: "roleId is required",
      };
    }

    const roleRepository = getRoleRepository();
    await roleRepository.delete(roleId);

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Role deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete role",
    };
  }
}

// Additional enhanced role management functions using the repository

export async function createDefaultRoles(organizationId: number): Promise<Result> {
  try {
    if (!organizationId) {
      return {
        success: false,
        error: "Organization ID is required",
      };
    }

    const roleRepository = getRoleRepository();
    const defaultRoles = await roleRepository.createDefaultRoles(organizationId);

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: defaultRoles,
    };
  } catch (error) {
    console.error("Error creating default roles:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create default roles",
    };
  }
}

export async function addPermissionToRole(roleId: number, permission: string): Promise<Result> {
  try {
    if (!roleId || !permission) {
      return {
        success: false,
        error: "Role ID and permission are required",
      };
    }

    const roleRepository = getRoleRepository();
    await roleRepository.addPermission(roleId, permission);

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Permission added successfully" },
    };
  } catch (error) {
    console.error("Error adding permission to role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add permission",
    };
  }
}

export async function removePermissionFromRole(roleId: number, permission: string): Promise<Result> {
  try {
    if (!roleId || !permission) {
      return {
        success: false,
        error: "Role ID and permission are required",
      };
    }

    const roleRepository = getRoleRepository();
    await roleRepository.removePermission(roleId, permission);

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Permission removed successfully" },
    };
  } catch (error) {
    console.error("Error removing permission from role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove permission",
    };
  }
}

export async function getRolesByPermission(organizationId: number, permission: string) {
  try {
    if (!organizationId || !permission) {
      throw new Error("Organization ID and permission are required");
    }

    const roleRepository = getRoleRepository();
    return await roleRepository.findRolesByPermission(organizationId, permission);
  } catch (error) {
    console.error("Error fetching roles by permission:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to fetch roles by permission");
  }
}

export async function cloneRole(sourceRoleId: number, newName: string, organizationId?: number): Promise<Result> {
  try {
    if (!sourceRoleId || !newName) {
      return {
        success: false,
        error: "Source role ID and new name are required",
      };
    }

    const roleRepository = getRoleRepository();
    const clonedRole = await roleRepository.cloneRole(sourceRoleId, newName, organizationId);

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: clonedRole,
    };
  } catch (error) {
    console.error("Error cloning role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clone role",
    };
  }
}