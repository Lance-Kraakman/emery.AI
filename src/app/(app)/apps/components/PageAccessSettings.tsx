/**
 * PageAccessSettings - Configure page authentication and role-based access
 *
 * AIDEV-NOTE: Allows setting requiresAuth and allowedRoles for published pages.
 * Integrates with existing RBAC system to provide role-based access control.
 */

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { getOrganizationRoles, type CustomRole } from "@/app/actions/roles";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PageAccessSettingsProps {
  pageId: number;
  isPublic: boolean;
  initialRequiresAuth: boolean;
  initialAllowedRoles: string[];
  onSave: (data: {
    requiresAuth: boolean;
    allowedRoles: string[];
  }) => Promise<void>;
}

export function PageAccessSettings({
  pageId,
  isPublic,
  initialRequiresAuth,
  initialAllowedRoles,
  onSave,
}: PageAccessSettingsProps) {
  const [requiresAuth, setRequiresAuth] = React.useState(initialRequiresAuth);
  const [allowedRoles, setAllowedRoles] = React.useState<string[]>(
    initialAllowedRoles || []
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [roles, setRoles] = React.useState<CustomRole[]>([]);
  const [rolesLoading, setRolesLoading] = React.useState(true);
  const [rolePickerOpen, setRolePickerOpen] = React.useState(false);

  // Load organization roles
  React.useEffect(() => {
    const loadRoles = async () => {
      try {
        setRolesLoading(true);
        const rolesData = await getOrganizationRoles();
        setRoles(rolesData);
      } catch (error) {
        console.error("Error loading roles:", error);
        toast.error("Failed to load organization roles");
      } finally {
        setRolesLoading(false);
      }
    };

    loadRoles();
  }, []);

  // Track changes
  React.useEffect(() => {
    const authChanged = requiresAuth !== initialRequiresAuth;
    const rolesChanged =
      JSON.stringify([...allowedRoles].sort()) !==
      JSON.stringify([...(initialAllowedRoles || [])].sort());
    setHasChanges(authChanged || rolesChanged);
  }, [requiresAuth, allowedRoles, initialRequiresAuth, initialAllowedRoles]);

  // Reset when initial values change
  React.useEffect(() => {
    setRequiresAuth(initialRequiresAuth);
    setAllowedRoles(initialAllowedRoles || []);
  }, [initialRequiresAuth, initialAllowedRoles]);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      await onSave({
        requiresAuth,
        allowedRoles,
      });

      toast.success("Access settings updated");
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving access settings:", error);
      toast.error("Failed to save access settings");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRole = (roleName: string) => {
    setAllowedRoles((current) =>
      current.includes(roleName)
        ? current.filter((r) => r !== roleName)
        : [...current, roleName]
    );
  };

  const removeRole = (roleName: string) => {
    setAllowedRoles((current) => current.filter((r) => r !== roleName));
  };

  // Generate access summary
  const getAccessSummary = () => {
    if (!isPublic) {
      return "Page is private (not published)";
    }

    if (!requiresAuth) {
      return "Anyone can view this page";
    }

    if (allowedRoles.length === 0) {
      return "All authenticated users can view";
    }

    return `Only users with roles: ${allowedRoles.join(", ")}`;
  };

  return (
    <div className="w-full space-y-1.5 px-3 py-2">
      {/* Access Summary */}
      <div className="p-2 bg-muted/50 rounded-md border border-border">
        <p className="text-xs text-muted-foreground">{getAccessSummary()}</p>
      </div>

      <div className="space-y-3 pt-2">
        {/* Requires Authentication Toggle */}
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5 flex-1">
            <Label className="text-xs">Requires Login</Label>
            <p className="text-xs text-muted-foreground leading-tight">
              {requiresAuth
                ? "Users must sign in"
                : "Anyone can view"}
            </p>
          </div>
          <Switch
            checked={requiresAuth}
            onCheckedChange={setRequiresAuth}
            disabled={!isPublic}
          />
        </div>

        {/* Role Selection */}
        {requiresAuth && (
          <div className="space-y-2">
            <Label className="text-xs">Allowed Roles</Label>
            <p className="text-xs text-muted-foreground leading-tight">
              Leave empty to allow all authenticated users
            </p>

            {/* Selected Roles */}
            {allowedRoles.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {allowedRoles.map((roleName) => (
                  <Badge
                    key={roleName}
                    variant="secondary"
                    className="text-xs px-2 py-0.5"
                  >
                    {roleName}
                    <button
                      onClick={() => removeRole(roleName)}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Role Picker */}
            <Popover open={rolePickerOpen} onOpenChange={setRolePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs justify-start"
                  disabled={rolesLoading}
                >
                  {rolesLoading ? "Loading roles..." : "Add role..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search roles..."
                    className="h-8 text-xs"
                  />
                  <CommandEmpty>No roles found</CommandEmpty>
                  <CommandGroup className="max-h-[200px] overflow-auto">
                    {roles.map((role) => (
                      <CommandItem
                        key={role.id}
                        value={role.name}
                        onSelect={() => {
                          toggleRole(role.name);
                          setRolePickerOpen(false);
                        }}
                        className="text-xs"
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            allowedRoles.includes(role.name)
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </div>
                        <span>{role.name}</span>
                        {role.isSystem && (
                          <Badge
                            variant="outline"
                            className="ml-auto text-[10px] px-1 py-0"
                          >
                            System
                          </Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Save Button */}
        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={isSaving || !isPublic}
            size="sm"
            className="w-full h-7 text-xs"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        )}

        {/* Warning if not public */}
        {!isPublic && (
          <p className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950 p-2 rounded border border-yellow-200 dark:border-yellow-800">
            Publish this page first to configure access
          </p>
        )}
      </div>
    </div>
  );
}
